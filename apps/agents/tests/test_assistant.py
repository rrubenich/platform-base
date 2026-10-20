import json

import pytest
from fastapi.testclient import TestClient

from agents_service.jobs import Caller, JobView

from .conftest import AUTH, FailingChatModel, FakeQueue

CHAT = {"messages": [{"role": "user", "content": "Oi"}]}


def sse_events(body: str) -> list[tuple[str, object]]:
    events: list[tuple[str, object]] = []
    for frame in body.strip().split("\n\n"):
        fields = dict(
            line.split(": ", 1) for line in frame.splitlines() if ": " in line
        )
        if "event" in fields:
            events.append((fields["event"], json.loads(fields["data"])))
    return events


@pytest.mark.parametrize(
    "headers",
    [{}, {**AUTH, "X-Service-Token": "wrong"}],
    ids=["missing", "wrong"],
)
def test_rejects_requests_without_the_service_token(
    client: TestClient, headers: dict[str, str]
) -> None:
    assert (
        client.post("/v1/assistant/chat", json=CHAT, headers=headers).status_code == 401
    )
    assert client.get("/v1/assistant/jobs/job-1", headers=headers).status_code == 401


def test_requires_the_caller_headers(client: TestClient) -> None:
    headers = {"X-Service-Token": "test-token"}

    assert (
        client.post("/v1/assistant/chat", json=CHAT, headers=headers).status_code == 422
    )


def test_rejects_a_conversation_that_does_not_end_with_the_user(
    client: TestClient,
) -> None:
    body = {"messages": [{"role": "assistant", "content": "Olá"}]}

    assert client.post("/v1/assistant/chat", json=body, headers=AUTH).status_code == 422


def test_streams_the_reply_then_done(client: TestClient) -> None:
    response = client.post("/v1/assistant/chat", json=CHAT, headers=AUTH)

    assert response.headers["content-type"].startswith("text/event-stream")
    events = sse_events(response.text)
    assert {kind for kind, _ in events[:-1]} == {"delta"}
    assert "".join(data["text"] for _, data in events[:-1]) == "Olá, tudo bem?"  # type: ignore[index]
    assert events[-1] == ("done", {"type": "done"})


@pytest.mark.parametrize("model", [FailingChatModel(messages=iter([]))])
def test_reports_a_model_failure_as_an_error_event(client: TestClient) -> None:
    response = client.post("/v1/assistant/chat", json=CHAT, headers=AUTH)

    assert response.status_code == 200
    assert sse_events(response.text) == [
        (
            "error",
            {
                "type": "error",
                "code": "model_error",
                "message": "The assistant failed.",
            },
        )
    ]


def test_queues_a_job_for_the_caller(client: TestClient, queue: FakeQueue) -> None:
    response = client.post(
        "/v1/assistant/jobs", json={"prompt": "Resuma"}, headers=AUTH
    )

    assert response.status_code == 202
    assert response.json() == {"id": "job-1"}
    assert queue.enqueued == [
        (
            "run_assistant",
            Caller(user_id="user-1", organization_id="org-1"),
            {"prompt": "Resuma"},
        )
    ]


def test_returns_a_job_of_the_callers_organization(
    client: TestClient, queue: FakeQueue
) -> None:
    view = JobView(
        id="job-1", agent="run_assistant", status="succeeded", result={"text": "ok"}
    )
    queue.jobs["job-1"] = (Caller(user_id="user-2", organization_id="org-1"), view)

    response = client.get("/v1/assistant/jobs/job-1", headers=AUTH)

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"


def test_hides_jobs_of_other_organizations(
    client: TestClient, queue: FakeQueue
) -> None:
    view = JobView(id="job-1", agent="run_assistant", status="queued")
    queue.jobs["job-1"] = (Caller(user_id="user-2", organization_id="org-2"), view)

    assert client.get("/v1/assistant/jobs/job-1", headers=AUTH).status_code == 404

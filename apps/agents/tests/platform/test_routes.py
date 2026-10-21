import time

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel

from agents_service.platform import Registry
from agents_service.platform.auth import MemberCaller
from agents_service.platform.jobs import JobView
from agents_service.testing import AgentHarness, ScriptedModel, reply

from ..conftest import bearer, make_token, sse_events
from .agents import TEAM

COORDINATOR = bearer(make_token(scope="coordinator"))
CHAT = {"message": "Oi"}


@pytest.fixture
def registry() -> Registry:
    return TEAM


@pytest.fixture
def models() -> dict[str, BaseChatModel]:
    return {"coordinator": ScriptedModel(reply("Olá!"), reply("De novo."))}


@pytest.mark.parametrize(
    "headers",
    [
        {},
        bearer("not-a-jwt"),
        bearer(make_token(key=Ed25519PrivateKey.generate())),
        bearer(make_token(exp=int(time.time()) - 60)),
        bearer(make_token(aud="someone-else")),
        bearer(make_token(iss="someone-else")),
        bearer(make_token(sub="")),
        bearer(make_token(scope=None)),
        bearer(make_token(org="")),
    ],
    ids=[
        "missing",
        "malformed",
        "signed by another key",
        "expired",
        "wrong audience",
        "wrong issuer",
        "empty user",
        "no scope",
        "empty organization",
    ],
)
def test_rejects_requests_without_a_valid_token(
    client: TestClient, headers: dict[str, str]
) -> None:
    for response in [
        client.post("/v1/agents/coordinator/chat", json=CHAT, headers=headers),
        client.get("/v1/agents/coordinator/threads/t1", headers=headers),
        client.post(
            "/v1/agents/coordinator/jobs", json={"prompt": "x"}, headers=headers
        ),
        client.get("/v1/agents/coordinator/jobs/job-1", headers=headers),
    ]:
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"


def test_streams_the_thread_then_the_reply(client: TestClient) -> None:
    response = client.post(
        "/v1/agents/coordinator/chat", json=CHAT, headers=COORDINATOR
    )

    assert response.headers["content-type"].startswith("text/event-stream")
    events = sse_events(response.text)
    kind, thread = events[0]
    assert kind == "thread"
    assert len(thread["id"]) == 32
    assert events[1:] == [
        ("delta", {"type": "delta", "text": "Olá!"}),
        ("done", {"type": "done"}),
    ]


def test_continues_a_thread_and_returns_its_history(client: TestClient) -> None:
    body = {"message": "Oi", "thread_id": "conversa-1"}
    client.post("/v1/agents/coordinator/chat", json=body, headers=COORDINATOR)
    second = client.post(
        "/v1/agents/coordinator/chat",
        json={"message": "E agora?", "thread_id": "conversa-1"},
        headers=COORDINATOR,
    )

    assert sse_events(second.text)[0] == (
        "thread",
        {"type": "thread", "id": "conversa-1"},
    )
    response = client.get(
        "/v1/agents/coordinator/threads/conversa-1", headers=COORDINATOR
    )
    assert response.json() == {
        "id": "conversa-1",
        "messages": [
            {"role": "user", "content": "Oi"},
            {"role": "assistant", "content": "Olá!"},
            {"role": "user", "content": "E agora?"},
            {"role": "assistant", "content": "De novo."},
        ],
    }


def test_hides_threads_of_other_users(client: TestClient) -> None:
    client.post(
        "/v1/agents/coordinator/chat",
        json={"message": "Oi", "thread_id": "t1"},
        headers=COORDINATOR,
    )
    eve = bearer(make_token(scope="coordinator", sub="eve"))

    assert (
        client.get("/v1/agents/coordinator/threads/t1", headers=eve).status_code == 404
    )


@pytest.mark.parametrize(
    "body",
    [
        {"message": ""},
        {"messages": [{"role": "user", "content": "old shape"}]},
        {"message": "Oi", "thread_id": "org-2:eve:coordinator:t1"},
        {"message": "Oi", "thread_id": "x" * 65},
    ],
    ids=["empty message", "old request shape", "forged thread key", "long thread id"],
)
def test_rejects_an_invalid_chat_request(client: TestClient, body: object) -> None:
    response = client.post(
        "/v1/agents/coordinator/chat", json=body, headers=COORDINATOR
    )

    assert response.status_code == 422


def test_rejects_a_forged_thread_key_in_the_path(client: TestClient) -> None:
    response = client.get(
        "/v1/agents/coordinator/threads/org-2:eve:coordinator:t1", headers=COORDINATOR
    )

    assert response.status_code == 422


def test_reports_a_model_failure_as_an_error_event(
    client: TestClient, models: dict[str, BaseChatModel]
) -> None:
    models["coordinator"] = ScriptedModel(RuntimeError("401 invalid api key"))

    response = client.post(
        "/v1/agents/coordinator/chat", json=CHAT, headers=COORDINATOR
    )

    assert response.status_code == 200
    assert sse_events(response.text)[1:] == [
        (
            "error",
            {
                "type": "error",
                "code": "model_error",
                "message": "The assistant failed.",
            },
        )
    ]


@pytest.mark.parametrize(
    ("path", "token", "status"),
    [
        ("/v1/agents/ghost/chat", make_token(scope="ghost"), 404),
        ("/v1/agents/coordinator/chat", make_token(scope="researcher"), 403),
        ("/v1/agents/coordinator/chat", make_token(scope="coordinator", org=None), 403),
        ("/v1/agents/reporter/chat", make_token(scope="reporter"), 404),
        ("/v1/agents/admin_tool/chat", make_token(scope="admin_tool", org=None), 200),
    ],
    ids=[
        "unknown agent",
        "token for another agent",
        "member agent without organization",
        "agent without chat",
        "platform agent without organization",
    ],
)
def test_checks_the_agent_scope_audience_and_mode(
    client: TestClient,
    models: dict[str, BaseChatModel],
    path: str,
    token: str,
    status: int,
) -> None:
    models["admin_tool"] = ScriptedModel(reply("ok"))

    assert client.post(path, json=CHAT, headers=bearer(token)).status_code == status


def test_a_token_for_several_agents_reaches_each(
    client: TestClient, models: dict[str, BaseChatModel]
) -> None:
    models["researcher"] = ScriptedModel(reply("ok"))
    both = bearer(make_token(scope="coordinator researcher"))

    for agent in ["coordinator", "researcher"]:
        response = client.post(f"/v1/agents/{agent}/chat", json=CHAT, headers=both)
        assert sse_events(response.text)[-1] == ("done", {"type": "done"})


def test_queues_a_job_for_the_caller(client: TestClient, harness: AgentHarness) -> None:
    response = client.post(
        "/v1/agents/coordinator/jobs", json={"prompt": "Resuma"}, headers=COORDINATOR
    )

    assert response.status_code == 202
    assert response.json() == {"id": "job-1"}
    assert harness.queue.enqueued == [
        (
            "coordinator",
            MemberCaller(user_id="user-1", organization_id="org-1"),
            "Resuma",
        )
    ]


def test_jobs_need_an_agent_that_runs_them(client: TestClient) -> None:
    researcher = bearer(make_token(scope="researcher"))

    response = client.post(
        "/v1/agents/researcher/jobs", json={"prompt": "x"}, headers=researcher
    )

    assert response.status_code == 404


def test_returns_a_job_of_the_callers_organization(
    client: TestClient, harness: AgentHarness
) -> None:
    view = JobView(
        id="job-1", agent="coordinator", status="succeeded", result={"text": "ok"}
    )
    harness.queue.jobs["job-1"] = (MemberCaller("user-2", "org-1"), view)

    response = client.get("/v1/agents/coordinator/jobs/job-1", headers=COORDINATOR)

    assert response.status_code == 200
    assert response.json()["result"] == {"text": "ok"}


@pytest.mark.parametrize(
    ("owner", "agent"),
    [
        (MemberCaller("user-2", "org-2"), "coordinator"),
        (MemberCaller("user-1", "org-1"), "reporter"),
    ],
    ids=["another organization", "another agent"],
)
def test_hides_jobs_the_caller_may_not_see(
    client: TestClient, harness: AgentHarness, owner: MemberCaller, agent: str
) -> None:
    harness.queue.jobs["job-1"] = (
        owner,
        JobView(id="job-1", agent=agent, status="queued"),
    )

    assert (
        client.get("/v1/agents/coordinator/jobs/job-1", headers=COORDINATOR).status_code
        == 404
    )

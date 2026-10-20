import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from agents_service.agents.docs.library import DocsLibrary
from agents_service.agents.docs.router import get_docs_library
from agents_service.dependencies import get_chat_model

from ...conftest import CHAT, ToolCallingFakeModel, bearer, make_token, sse_events

ADMIN = bearer(make_token(scope="docs", org=None))


@pytest.fixture
def docs_client(client: TestClient, library: DocsLibrary) -> TestClient:
    # The model first searches the docs, then answers from what it found.
    model = ToolCallingFakeModel(
        messages=iter(
            [
                AIMessage(
                    "",
                    tool_calls=[
                        {
                            "name": "search_docs",
                            "args": {"query": "JWT"},
                            "id": "call-1",
                        }
                    ],
                ),
                AIMessage("Os tokens são JWTs EdDSA.\n\nSources: AGENTS.md"),
            ]
        )
    )
    app = client.app
    app.dependency_overrides[get_chat_model] = lambda: model  # type: ignore[attr-defined]
    app.dependency_overrides[get_docs_library] = lambda: library  # type: ignore[attr-defined]
    return client


def test_answers_from_the_docs_reporting_each_tool_call(
    docs_client: TestClient,
) -> None:
    response = docs_client.post("/v1/docs/chat", json=CHAT, headers=ADMIN)

    events = sse_events(response.text)
    assert events[0] == (
        "tool",
        {"type": "tool", "name": "search_docs", "args": {"query": "JWT"}},
    )
    text = "".join(data["text"] for kind, data in events if kind == "delta")  # type: ignore[index]
    assert text == "Os tokens são JWTs EdDSA.\n\nSources: AGENTS.md"
    assert events[-1] == ("done", {"type": "done"})


def test_needs_a_token_issued_for_the_docs_agent(docs_client: TestClient) -> None:
    assistant_token = bearer(make_token(scope="assistant"))

    assert (
        docs_client.post(
            "/v1/docs/chat", json=CHAT, headers=assistant_token
        ).status_code
        == 403
    )
    assert docs_client.post("/v1/docs/chat", json=CHAT).status_code == 401

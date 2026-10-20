from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from agents_service.agents.docs import MAX_READ_CHARS, DocsLibrary
from agents_service.dependencies import get_chat_model, get_docs_library

from .conftest import ToolCallingFakeModel, bearer, make_token
from .test_assistant import CHAT, sse_events

ADMIN = bearer(make_token(scope="docs", org=None))


@pytest.fixture
def library(tmp_path: Path) -> DocsLibrary:
    (tmp_path / "docs").mkdir()
    (tmp_path / "AGENTS.md").write_text("# Agents guide\nTokens are EdDSA JWTs.\n")
    (tmp_path / "docs" / "routes.md").write_text("# Routes\nGET /api/health\n")
    (tmp_path / "notes.txt").write_text("not a doc")
    (tmp_path / ".env").write_text("SECRET=1")
    return DocsLibrary(tmp_path)


def test_lists_only_markdown_docs_with_their_titles(library: DocsLibrary) -> None:
    assert library.list_docs() == "- AGENTS.md: Agents guide\n- docs/routes.md: Routes"


def test_searches_every_doc_case_insensitively(library: DocsLibrary) -> None:
    assert library.search_docs("eddsa") == "AGENTS.md:2: Tokens are EdDSA JWTs."
    assert (
        library.search_docs("nothing like this")
        == "No matches for 'nothing like this'."
    )


@pytest.mark.parametrize("path", [".env", "notes.txt", "../etc/passwd", "/etc/passwd"])
def test_reads_nothing_outside_the_listed_docs(library: DocsLibrary, path: str) -> None:
    assert library.read_doc(path).startswith("No document")


def test_reads_long_docs_in_parts(library: DocsLibrary) -> None:
    (library.root / "docs" / "long.md").write_text("x" * (MAX_READ_CHARS + 5))

    first = library.read_doc("docs/long.md")
    rest = library.read_doc("docs/long.md", offset=MAX_READ_CHARS)

    assert f"offset={MAX_READ_CHARS}" in first
    assert rest == "xxxxx"


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

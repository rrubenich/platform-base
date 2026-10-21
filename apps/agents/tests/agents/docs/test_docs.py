import pytest

from agents_service.agents import REGISTRY
from agents_service.agents.docs.library import DocsLibrary
from agents_service.config import get_settings
from agents_service.testing import AgentHarness, ScriptedModel, call, reply


@pytest.fixture
def docs_harness(library: DocsLibrary) -> tuple[AgentHarness, ScriptedModel]:
    model = ScriptedModel(
        call("search_docs", query="JWT"),
        call("read_doc", path="AGENTS.md"),
        reply("Os tokens são JWTs EdDSA.\n\nSources: AGENTS.md"),
    )
    settings = get_settings().model_copy(update={"docs_root": library.root})
    return AgentHarness(REGISTRY, models={"docs": model}, settings=settings), model


async def test_answers_from_the_docs_it_looked_up(
    docs_harness: tuple[AgentHarness, ScriptedModel],
) -> None:
    harness, model = docs_harness

    transcript = await harness.chat("docs", "Como funcionam os tokens?")

    assert transcript.tool_calls == [
        ("search_docs", {"query": "JWT"}),
        ("read_doc", {"path": "AGENTS.md"}),
    ]
    assert transcript.text.endswith("Sources: AGENTS.md")
    # What the tools returned is what the model answered from.
    assert "AGENTS.md:2: Tokens are EdDSA JWTs." in model.requests[1].messages[-1].text
    assert "Tokens are EdDSA JWTs." in model.requests[2].messages[-1].text


async def test_runs_for_admins_without_an_organization(
    docs_harness: tuple[AgentHarness, ScriptedModel],
) -> None:
    harness, _ = docs_harness

    assert harness.context("docs").organization_id is None
    await harness.chat("docs", "Oi")

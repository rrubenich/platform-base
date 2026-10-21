import re

import pytest
from langchain_core.language_models import BaseChatModel
from langsmith import testing as t

from agents_service.agents.docs.library import DocsLibrary
from agents_service.config import get_settings
from agents_service.testing import AgentHarness

from .judge import judge

LOOKUP_TOOLS = {"list_docs", "search_docs", "read_doc"}

QUESTIONS = [
    ("How do I add a new agent to the agents service?", "AGENTS.md"),
    ("Quais rotas da API exigem ser membro de uma organização?", "docs/routes.md"),
]


def cited(answer: str) -> set[str]:
    """Paths listed under the answer's Sources heading."""
    _, _, sources = answer.rpartition("Sources")
    return set(re.findall(r"[\w./-]+\.md", sources))


@pytest.mark.langsmith
@pytest.mark.parametrize(("question", "expected_source"), QUESTIONS)
async def test_docs_answers_from_the_docs(
    harness: AgentHarness, model: BaseChatModel, question: str, expected_source: str
) -> None:
    t.log_inputs({"question": question})
    t.log_reference_outputs({"source": expected_source})

    transcript = await harness.chat("docs", question)
    t.log_outputs({"answer": transcript.text, "tools": transcript.tool_calls})

    used = {name for name, _ in transcript.tool_calls}
    sources = cited(transcript.text)
    existing = set(DocsLibrary(get_settings().docs_root).paths())
    t.log_feedback(key="looked_up", score=int(bool(used & LOOKUP_TOOLS)))
    t.log_feedback(key="cites_expected", score=int(expected_source in sources))
    t.log_feedback(key="cites_only_real_files", score=int(sources <= existing))

    assert used & LOOKUP_TOOLS, "answered without looking anything up"
    assert expected_source in sources, f"expected {expected_source} in {sources}"
    assert sources <= existing, f"cited files that don't exist: {sources - existing}"
    verdict = await judge(
        model,
        question=question,
        answer=transcript.text,
        criterion="The reply answers the question in the language it was asked in.",
    )
    t.log_feedback(key="answers", score=int(verdict.passed), comment=verdict.reasoning)
    assert verdict.passed, verdict.reasoning


@pytest.mark.langsmith
async def test_docs_declines_off_topic_questions(
    harness: AgentHarness, model: BaseChatModel
) -> None:
    question = "Me passa uma receita de bolo de cenoura?"
    t.log_inputs({"question": question})

    transcript = await harness.chat("docs", question)
    t.log_outputs({"answer": transcript.text})

    verdict = await judge(
        model,
        question=question,
        answer=transcript.text,
        criterion="The reply declines briefly because the question isn't about "
        "Platform Base, "
        "and gives no recipe.",
    )
    t.log_feedback(key="declines", score=int(verdict.passed), comment=verdict.reasoning)
    assert verdict.passed, verdict.reasoning

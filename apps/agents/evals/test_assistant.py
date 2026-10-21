import pytest
from langchain_core.language_models import BaseChatModel
from langsmith import testing as t

from agents_service.testing import AgentHarness

from .judge import judge

CASES = [
    (
        "Pode me explicar em duas frases o que é uma API REST?",
        "The reply is written in Portuguese and is at most about three sentences.",
    ),
    (
        "Quanto a nossa empresa faturou no mês passado?",
        "The reply does not invent a number; it says it doesn't have that "
        "information or can't know it.",
    ),
    (
        "Write a one-line welcome message for new customers.",
        "The reply is in English and is a single short welcome line.",
    ),
]


@pytest.mark.langsmith
@pytest.mark.parametrize(("question", "criterion"), CASES)
async def test_assistant(
    harness: AgentHarness, model: BaseChatModel, question: str, criterion: str
) -> None:
    t.log_inputs({"question": question})
    t.log_reference_outputs({"criterion": criterion})

    transcript = await harness.chat("assistant", question)
    t.log_outputs({"answer": transcript.text})

    verdict = await judge(
        model, question=question, answer=transcript.text, criterion=criterion
    )
    t.log_feedback(
        key="criterion", score=int(verdict.passed), comment=verdict.reasoning
    )
    assert verdict.passed, verdict.reasoning

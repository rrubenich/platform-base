"""An LLM grader for what can't be checked with code."""

from typing import cast

from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel, Field

INSTRUCTIONS = """\
You grade an AI assistant's reply against one criterion. Read the user's \
message, the reply and the criterion. Judge only the criterion, strictly: \
when in doubt, it fails."""


class Verdict(BaseModel):
    reasoning: str = Field(
        description="Why it passes or fails, in one or two sentences."
    )
    passed: bool


async def judge(
    model: BaseChatModel, *, question: str, answer: str, criterion: str
) -> Verdict:
    grader = model.with_structured_output(Verdict)
    verdict = await grader.ainvoke(
        [
            ("system", INSTRUCTIONS),
            (
                "user",
                f"<message>\n{question}\n</message>\n\n<reply>\n{answer}\n</reply>\n\n"
                f"<criterion>\n{criterion}\n</criterion>",
            ),
        ]
    )
    return cast(Verdict, verdict)

from typing import Any

import pytest

from agents_service.config import get_settings
from agents_service.platform import Agent

VALID: dict[str, Any] = {
    "name": "helper",
    "description": "Helps.",
    "instructions": "You help.",
}


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"name": "Helper"}, "must match"),
        ({"name": "with-dash"}, "must match"),
        ({"name": "9lives"}, "must match"),
        ({"description": "  "}, "needs a description"),
        ({"instructions": None}, "exactly one of instructions or graph"),
        ({"graph": lambda _build: None}, "exactly one of instructions or graph"),
        ({"modes": frozenset()}, "must offer"),
        (
            {"audience": "platform", "modes": frozenset({"job"})},
            "jobs need the member audience",
        ),
    ],
    ids=[
        "uppercase name",
        "dashed name",
        "leading digit",
        "blank description",
        "no instructions or graph",
        "both instructions and graph",
        "no modes",
        "platform jobs",
    ],
)
def test_rejects_an_invalid_definition(changes: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        Agent(**{**VALID, **changes})


def test_defaults_to_a_member_chat_agent() -> None:
    agent = Agent(**VALID)

    assert (agent.audience, agent.modes) == ("member", frozenset({"chat"}))


def test_resolves_tools_that_need_settings() -> None:
    settings = get_settings()
    agent = Agent(**VALID, tools=lambda s: [s.llm_model])

    assert agent.resolve_tools(settings) == [settings.llm_model]

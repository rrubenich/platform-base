"""The harness itself: if it lied, every agent test would too."""

import pytest

from agents_service.testing import (
    AgentHarness,
    ScriptedModel,
    ScriptExhaustedError,
    call,
    calls,
    reply,
)

from .platform.agents import TEAM


async def test_fails_when_the_agent_calls_the_model_more_than_scripted() -> None:
    harness = AgentHarness(TEAM, models={"researcher": ScriptedModel(call("whoami"))})

    with pytest.raises(AssertionError, match="ended its turn with an error event"):
        await harness.chat("researcher", "Oi")


async def test_reports_how_many_replies_were_missing() -> None:
    model = ScriptedModel()

    with pytest.raises(ScriptExhaustedError, match="called the model 1 times"):
        await model.ainvoke("Oi")


async def test_can_expect_an_error_instead_of_failing() -> None:
    harness = AgentHarness(
        TEAM, models={"researcher": ScriptedModel(RuntimeError("outage"))}
    )

    transcript = await harness.chat("researcher", "Oi", check=False)

    assert transcript.error is not None
    assert transcript.error.code == "model_error"


async def test_fails_when_an_agent_runs_without_a_scripted_model() -> None:
    harness = AgentHarness(
        TEAM,
        models={
            "coordinator": ScriptedModel(
                call("ask_researcher", request="x"), reply("ok")
            )
        },
    )

    # The delegation fails (no model for the researcher) and is reported to
    # the coordinator, as any delegate failure would be.
    await harness.chat("coordinator", "Oi")
    model = harness.models["coordinator"]
    assert isinstance(model, ScriptedModel)
    assert model.requests[1].messages[-1].text == "The researcher agent failed."


async def test_plays_parallel_tool_calls() -> None:
    model = ScriptedModel(calls(("whoami", {}), ("whoami", {})), reply("Duas vezes."))
    harness = AgentHarness(TEAM, models={"researcher": model})

    transcript = await harness.chat("researcher", "Oi")

    assert transcript.tool_calls == [("whoami", {}), ("whoami", {})]
    assert model.remaining == 0

import logging

import pytest

from agents_service.platform.delegation import MAX_DELEGATION_DEPTH
from agents_service.testing import AgentHarness, ScriptedModel, call, reply

from .agents import TEAM, chain


def team(**models: ScriptedModel) -> AgentHarness:
    return AgentHarness(TEAM, models=models)


async def test_the_parent_sees_its_delegates_as_tools() -> None:
    parent = ScriptedModel(reply("ok"))

    await team(coordinator=parent).chat("coordinator", "Oi")

    assert parent.requests[0].tools == ["whoami", "ask_researcher", "start_reporter"]


async def test_asking_a_delegate_returns_its_answer_to_the_parent() -> None:
    parent = ScriptedModel(
        call("ask_researcher", request="Capital of Brazil?"),
        reply("Brasília, per the researcher."),
    )
    child = ScriptedModel(reply("Brasília."))

    transcript = await team(coordinator=parent, researcher=child).chat(
        "coordinator", "Qual a capital?"
    )

    assert transcript.tool_calls == [
        ("ask_researcher", {"request": "Capital of Brazil?"})
    ]
    assert transcript.text == "Brasília, per the researcher."
    # The delegate got the request as its own conversation, nothing else.
    assert [m.text for m in child.requests[0].messages[1:]] == ["Capital of Brazil?"]
    assert child.requests[0].system == "You research."
    # And its answer came back to the parent as the tool result.
    assert parent.requests[1].messages[-1].text == "Brasília."


async def test_the_delegate_runs_as_the_same_caller() -> None:
    parent = ScriptedModel(call("ask_researcher", request="who?"), reply("done"))
    child = ScriptedModel(call("whoami"), reply("I know"))

    await team(coordinator=parent, researcher=child).chat(
        "coordinator", "Oi", user_id="ana", organization_id="acme-7"
    )

    assert child.requests[1].messages[-1].text == "ana@acme-7 via researcher"


async def test_only_the_parents_text_reaches_the_user() -> None:
    parent = ScriptedModel(call("ask_researcher", request="x"), reply("Parent."))
    child = ScriptedModel(reply("CHILD TOKENS"))

    transcript = await team(coordinator=parent, researcher=child).chat(
        "coordinator", "Oi"
    )

    assert transcript.text == "Parent."
    assert all("CHILD" not in str(event) for event in transcript.events)


async def test_a_failing_delegate_is_reported_to_the_parent_not_the_user(
    caplog: pytest.LogCaptureFixture,
) -> None:
    parent = ScriptedModel(
        call("ask_researcher", request="x"), reply("The researcher is down.")
    )
    child = ScriptedModel(RuntimeError("provider outage"))

    with caplog.at_level(logging.ERROR):
        transcript = await team(coordinator=parent, researcher=child).chat(
            "coordinator", "Oi"
        )

    assert parent.requests[1].messages[-1].text == "The researcher agent failed."
    assert transcript.text == "The researcher is down."
    assert "delegation to researcher failed" in caplog.text


async def test_delegation_saves_nothing_in_the_parents_thread() -> None:
    parent = ScriptedModel(call("ask_researcher", request="x"), reply("Parent."))
    harness = team(coordinator=parent, researcher=ScriptedModel(reply("Child.")))

    transcript = await harness.chat("coordinator", "Oi")

    assert await harness.thread("coordinator", transcript.thread_id) == [
        ("user", "Oi"),
        ("assistant", "Parent."),
    ]
    # A delegate inheriting the checkpointer would save its own run under a
    # `tools:...` namespace of the parent's thread, and resume it next time.
    checkpointer = harness.platform.checkpointer
    assert checkpointer is not None
    namespaces = {
        saved.config.get("configurable", {}).get("checkpoint_ns")
        async for saved in checkpointer.alist(None)
    }
    assert namespaces == {""}


async def test_starting_a_background_delegate_queues_a_job_for_the_caller() -> None:
    parent = ScriptedModel(
        call("start_reporter", request="Monthly report"), reply("Started.")
    )
    harness = team(coordinator=parent)

    await harness.chat("coordinator", "Oi", user_id="ana", organization_id="org-9")

    [(agent, caller, prompt)] = harness.queue.enqueued
    assert (agent, prompt) == ("reporter", "Monthly report")
    assert (caller.user_id, caller.organization_id) == ("ana", "org-9")
    assert parent.requests[1].messages[-1].text == (
        "Started the reporter agent in the background (job job-1)."
    )


async def test_delegation_stops_at_the_depth_limit() -> None:
    length = MAX_DELEGATION_DEPTH + 2
    models = {
        f"agent_{i}": ScriptedModel(
            call(f"ask_agent_{i + 1}", request="deeper"), reply(f"done {i}")
        )
        for i in range(length - 1)
    }
    harness = AgentHarness(chain(length), models=models)

    await harness.chat("agent_0", "go")

    deepest = models[f"agent_{MAX_DELEGATION_DEPTH}"]
    assert deepest.requests[1].messages[-1].text == (
        f"Can't ask the agent_{MAX_DELEGATION_DEPTH + 1} agent: "
        "too many nested delegations."
    )


async def test_a_job_can_delegate_too() -> None:
    parent = ScriptedModel(call("ask_researcher", request="x"), reply("Report."))
    harness = team(coordinator=parent, researcher=ScriptedModel(reply("Facts.")))

    assert await harness.run("coordinator", "Write it") == "Report."

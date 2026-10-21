from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agents_service.platform import AgentContext
from agents_service.platform.threads import history, thread_key
from agents_service.testing import AgentHarness, ScriptedModel, call, reply

from .agents import TEAM


def test_keys_threads_by_organization_user_and_agent() -> None:
    member = AgentContext(user_id="ana", organization_id="org-1", agent="assistant")
    admin = AgentContext(user_id="root", organization_id=None, agent="docs")

    assert thread_key(member, "t1") == "org-1:ana:assistant:t1"
    assert thread_key(admin, "t1") == "platform:root:docs:t1"


def test_history_shows_only_what_the_user_saw() -> None:
    messages = [
        HumanMessage("Oi"),
        AIMessage("", tool_calls=[{"name": "whoami", "args": {}, "id": "c1"}]),
        ToolMessage("ana@org-1", tool_call_id="c1"),
        AIMessage("Olá, Ana."),
    ]

    assert [(m.role, m.content) for m in history(messages)] == [
        ("user", "Oi"),
        ("assistant", "Olá, Ana."),
    ]


async def test_a_thread_remembers_earlier_turns() -> None:
    model = ScriptedModel(reply("Prazer, Ana."), reply("Você é a Ana."))
    harness = AgentHarness(TEAM, models={"researcher": model})

    first = await harness.chat("researcher", "Sou a Ana.", thread_id="t1")
    await harness.chat("researcher", "Quem sou eu?", thread_id=first.thread_id)

    assert [m.text for m in model.requests[1].messages[1:]] == [
        "Sou a Ana.",
        "Prazer, Ana.",
        "Quem sou eu?",
    ]
    assert await harness.thread("researcher", "t1") == [
        ("user", "Sou a Ana."),
        ("assistant", "Prazer, Ana."),
        ("user", "Quem sou eu?"),
        ("assistant", "Você é a Ana."),
    ]


async def test_another_user_or_organization_never_sees_the_thread() -> None:
    model = ScriptedModel(reply("Segredo guardado."), reply("Não sei."))
    harness = AgentHarness(TEAM, models={"researcher": model})
    await harness.chat("researcher", "Meu segredo é X.", thread_id="t1")

    await harness.chat("researcher", "Qual o segredo?", thread_id="t1", user_id="eve")

    # Same thread id, another user: the model saw a fresh conversation.
    assert [m.text for m in model.requests[1].messages[1:]] == ["Qual o segredo?"]
    assert await harness.thread("researcher", "t1", organization_id="org-2") == []


async def test_threads_are_per_agent() -> None:
    harness = AgentHarness(
        TEAM,
        models={
            "researcher": ScriptedModel(reply("A")),
            "coordinator": ScriptedModel(reply("B")),
        },
    )
    await harness.chat("researcher", "Oi", thread_id="t1")

    assert await harness.thread("coordinator", "t1") == []


async def test_tool_calls_are_streamed_and_kept_out_of_the_history() -> None:
    model = ScriptedModel(call("whoami"), reply("Você é a user-1."))
    harness = AgentHarness(TEAM, models={"researcher": model})

    transcript = await harness.chat("researcher", "Quem sou eu?")

    assert transcript.tool_calls == [("whoami", {})]
    assert await harness.thread("researcher", transcript.thread_id) == [
        ("user", "Quem sou eu?"),
        ("assistant", "Você é a user-1."),
    ]

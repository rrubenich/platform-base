from agents_service.agents import REGISTRY
from agents_service.agents.assistant.agent import INSTRUCTIONS
from agents_service.testing import AgentHarness, ScriptedModel, reply


async def test_answers_with_its_instructions_as_the_system_prompt() -> None:
    model = ScriptedModel(reply("Olá! Como posso ajudar?"))
    harness = AgentHarness(REGISTRY, models={"assistant": model})

    transcript = await harness.chat("assistant", "Oi")

    assert transcript.text == "Olá! Como posso ajudar?"
    assert model.requests[0].system == INSTRUCTIONS


async def test_runs_a_background_task_to_completion() -> None:
    harness = AgentHarness(
        REGISTRY, models={"assistant": ScriptedModel(reply("Resumo pronto."))}
    )

    assert await harness.run("assistant", "Resuma a semana") == "Resumo pronto."

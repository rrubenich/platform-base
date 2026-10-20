from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from agents_service.agents.assistant import agent


async def test_run_returns_the_final_answer() -> None:
    model = GenericFakeChatModel(messages=iter([AIMessage("Resumo pronto.")]))

    assert (await agent.run(model, "Resuma")).text == "Resumo pronto."

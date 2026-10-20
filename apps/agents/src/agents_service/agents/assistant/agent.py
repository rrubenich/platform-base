# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""General-purpose assistant for organization members.

The reference for both execution modes: chat (streamed through
`chat.stream_graph`) and background jobs (`run`). An agent is a module
with frozen instructions, its tools and a `build(model)` returning a
LangGraph graph; a workflow that needs more than the tool-calling loop
builds its own `StateGraph` instead of `create_agent`.
"""

from typing import Any

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from ...chat import Graph

# Kept byte-for-byte stable so it stays a cacheable prompt prefix.
INSTRUCTIONS = (
    "You are Platform Base's assistant. You help members of an organization with their "
    "work. Answer in the language the user writes in. Be concise and say so "
    "when you are unsure instead of guessing."
)

# LangChain tools (`@tool` functions) the assistant may call.
TOOLS: list[Any] = []


def build(model: BaseChatModel) -> Graph:
    # Compiling is cheap next to a model call, so it isn't cached.
    return create_agent(model, TOOLS, system_prompt=INSTRUCTIONS, name="assistant")


class JobOutput(BaseModel):
    text: str


async def run(model: BaseChatModel, prompt: str) -> JobOutput:
    """A single non-interactive task; errors propagate so arq records them."""
    result = await build(model).ainvoke(
        {"messages": [{"role": "user", "content": prompt}]}
    )
    last: BaseMessage = result["messages"][-1]
    return JobOutput(text=last.text)

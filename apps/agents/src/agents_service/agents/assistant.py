# LangGraph's graph generics are partly untyped; relax only the rules that flag
# them, here at the one place graphs are built and run.
# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""General-purpose assistant: the reference agent for both execution modes.

The agent is a LangGraph graph (`build`), so it runs on whatever chat model
it is given. `stream_reply` backs interactive chat (SSE); `run` backs
background jobs. New agents follow the same shape: a module here with frozen
instructions, their tools, and a `build` function; a workflow that needs
more than the tool-calling loop builds its own `StateGraph` instead of
`create_agent`.
"""

import logging
from collections.abc import AsyncIterator
from typing import Any, Literal

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessageChunk, BaseMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Kept byte-for-byte stable so it stays a cacheable prompt prefix.
INSTRUCTIONS = (
    "You are Platform Base's assistant. You help members of an organization with their "
    "work. Answer in the language the user writes in. Be concise and say so "
    "when you are unsure instead of guessing."
)

# LangChain tools (`@tool` functions) the assistant may call.
TOOLS: list[Any] = []


# LangGraph's state generics are partly untyped; agents only need the graph's
# stream/invoke interface, so it is typed loosely here once.
Graph = CompiledStateGraph[Any, Any, Any, Any]


def build(model: BaseChatModel) -> Graph:
    # Compiling is cheap next to a model call, so it isn't cached.
    return create_agent(model, TOOLS, system_prompt=INSTRUCTIONS, name="assistant")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Delta(BaseModel):
    type: Literal["delta"] = "delta"
    text: str


class Done(BaseModel):
    type: Literal["done"] = "done"


class Error(BaseModel):
    type: Literal["error"] = "error"
    code: Literal["model_error"]
    message: str


StreamEvent = Delta | Done | Error


def _to_input(messages: list[ChatMessage]) -> dict[str, Any]:
    return {"messages": [{"role": m.role, "content": m.content} for m in messages]}


async def stream_reply(
    model: BaseChatModel, messages: list[ChatMessage]
) -> AsyncIterator[StreamEvent]:
    """Yields the reply's text as it's written, then `Done`, or an `Error`.

    The HTTP response has already started when the model fails, so failures
    are reported as an event rather than a status code.
    """
    try:
        async for chunk, _metadata in build(model).astream(
            _to_input(messages), stream_mode="messages"
        ):
            # Tool calls and tool results also stream through; only the
            # model's own text goes to the user.
            if isinstance(chunk, AIMessageChunk) and chunk.text:
                yield Delta(text=chunk.text)
    except Exception:
        # Provider errors (auth, rate limits, outages) have provider-specific
        # types; the details go to the logs, the client learns it failed.
        logger.exception("assistant stream failed")
        yield Error(code="model_error", message="The assistant failed.")
        return
    yield Done()


class JobOutput(BaseModel):
    text: str


async def run(model: BaseChatModel, prompt: str) -> JobOutput:
    """A single non-interactive task; errors propagate so arq records them."""
    result = await build(model).ainvoke(
        {"messages": [{"role": "user", "content": prompt}]}
    )
    last: BaseMessage = result["messages"][-1]
    return JobOutput(text=last.text)

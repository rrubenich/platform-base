# LangGraph's graph generics are partly untyped; relax only the rules that flag
# them, here and in the agents' modules where graphs are built and run.
# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""What every chat agent shares: the message it receives and the events it
streams back. Agents only provide a LangGraph graph.
"""

import logging
from collections.abc import AsyncIterator
from typing import Any, Literal, cast

from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Agents only need the graph's stream/invoke interface, typed loosely once.
Graph = CompiledStateGraph[Any, Any, Any, Any]


# A client-chosen thread id is only ever a suffix of the server-derived key
# (see threads.py), so it can't contain the key's separator.
THREAD_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    # Continues that conversation; omitted to start a new one.
    thread_id: str | None = Field(default=None, pattern=THREAD_ID_PATTERN)


class Thread(BaseModel):
    """Always the first event: the conversation's id, new or continued."""

    type: Literal["thread"] = "thread"
    id: str


class Delta(BaseModel):
    type: Literal["delta"] = "delta"
    text: str


class ToolUse(BaseModel):
    """The agent called one of its tools; lets the UI show what it's doing."""

    type: Literal["tool"] = "tool"
    name: str
    args: dict[str, Any]


class Done(BaseModel):
    type: Literal["done"] = "done"


class Error(BaseModel):
    type: Literal["error"] = "error"
    code: Literal["model_error"]
    message: str


StreamEvent = Thread | Delta | ToolUse | Done | Error

CHAT_EVENTS_DESCRIPTION = (
    "Events: `thread` (`{id}`) first, `delta` (`{text}`) as the reply is "
    "written, `tool` (`{name, args}`) when the agent uses a tool or asks "
    "another agent (`ask_<agent>`), then `done` or `error` (`{code, message}`)."
)


async def stream_graph(
    graph: Graph, message: str, config: RunnableConfig, context: Any
) -> AsyncIterator[StreamEvent]:
    """Yields the reply's text as it's written and each tool call the agent
    makes, then `Done`, or an `Error` at any point.

    The HTTP response has already started when the model fails, so failures
    are reported as an event rather than a status code.
    """
    try:
        async for mode, data in graph.astream(
            {"messages": [{"role": "user", "content": message}]},
            config,
            context=context,
            stream_mode=["messages", "updates"],
        ):
            if mode == "messages":
                chunk, _metadata = data
                # Tool results also stream through here; only the model's
                # own text goes to the user.
                if isinstance(chunk, AIMessageChunk) and chunk.text:
                    yield Delta(text=chunk.text)
            else:
                # A node finished; the model node's update carries the tool
                # calls it decided on, with complete arguments.
                updates = cast(dict[str, Any], data)
                for update in updates.values():
                    for item in (update or {}).get("messages", []):
                        if isinstance(item, AIMessage):
                            for call in item.tool_calls:
                                yield ToolUse(name=call["name"], args=call["args"])
    except Exception:
        # Provider errors (auth, rate limits, outages) have provider-specific
        # types; the details go to the logs, the client learns it failed.
        logger.exception("agent stream failed")
        yield Error(code="model_error", message="The assistant failed.")
        return
    yield Done()

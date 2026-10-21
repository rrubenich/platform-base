# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""Turns agent definitions into running graphs.

`Platform` holds what every run needs (the registry, the model, the
checkpointer, the job queue) and is the only place graphs are built, so
chat, jobs, delegation, Studio and the tests all run agents the same way.
"""

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any, Literal

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import BaseCheckpointSaver

from ..config import Settings
from .agent import AgentContext, BuildContext
from .chat import ChatMessage, Graph, StreamEvent, Thread, stream_graph
from .delegation import delegation_tools
from .jobs import JobQueue
from .registry import Registry
from .threads import history, thread_key

Entrypoint = Literal["chat", "job", "delegation", "studio"]


@dataclass(frozen=True)
class Platform:
    registry: Registry
    settings: Settings
    # The chat model an agent runs on, by agent name. In production every
    # agent gets the configured model; tests script one per agent.
    model_for: Callable[[str], BaseChatModel]
    # Saves chat threads; None where the platform doesn't persist them (the
    # worker's runs are one-off; Studio's server keeps its own).
    checkpointer: BaseCheckpointSaver[Any] | None = None
    # For `background(...)` delegates; None where jobs can't be queued.
    queue: JobQueue | None = None

    def graph(self, name: str, *, persistent: bool) -> Graph:
        """The agent's compiled graph. `persistent` graphs save their state
        in the checkpointer (chat threads); the others are one-off runs."""
        agent = self.registry.get(name)
        tools = [*agent.resolve_tools(self.settings), *delegation_tools(self, agent)]
        # One-off runs get False, not None: None would let a delegate inherit
        # its parent's checkpointer and write into the parent's thread. A
        # persistent graph without a checkpointer (None) is saved by whoever
        # serves it (LangGraph Studio).
        checkpointer: BaseCheckpointSaver[Any] | Literal[False] | None = (
            self.checkpointer if persistent else False
        )
        model = self.model_for(name)
        if agent.graph is not None:
            return agent.graph(
                BuildContext(
                    model=model,
                    tools=tools,
                    settings=self.settings,
                    checkpointer=checkpointer,
                )
            )
        # Compiling is cheap next to a model call, so it isn't cached.
        return create_agent(
            model,
            tools,
            system_prompt=agent.instructions,
            name=agent.name,
            context_schema=AgentContext,
            checkpointer=checkpointer,
        )

    async def chat(
        self, context: AgentContext, message: str, thread_id: str
    ) -> AsyncIterator[StreamEvent]:
        """One chat turn in the caller's thread: `Thread`, then the reply's
        events (see `stream_graph`)."""
        graph = self.graph(context.agent, persistent=True)
        config = run_config(context, "chat", thread_key=thread_key(context, thread_id))
        yield Thread(id=thread_id)
        async for event in stream_graph(graph, message, config, context):
            yield event

    async def thread(self, context: AgentContext, thread_id: str) -> list[ChatMessage]:
        """The caller's conversation so far; empty when there's none."""
        graph = self.graph(context.agent, persistent=True)
        config = run_config(context, "chat", thread_key=thread_key(context, thread_id))
        state = await graph.aget_state(config)
        return history(state.values.get("messages", []))

    async def run(
        self, context: AgentContext, prompt: str, *, entrypoint: Entrypoint
    ) -> str:
        """One non-interactive turn of `context.agent`: its final answer.
        Errors propagate; callers decide how to report them."""
        result = await self.graph(context.agent, persistent=False).ainvoke(
            {"messages": [{"role": "user", "content": prompt}]},
            run_config(context, entrypoint),
            context=context,
        )
        last: BaseMessage = result["messages"][-1]
        return last.text


def run_config(
    context: AgentContext,
    entrypoint: Entrypoint,
    *,
    thread_key: str | None = None,
) -> RunnableConfig:
    """Names and labels the run in LangSmith traces, and points it at its
    thread. Ids only: message content is traced by LangSmith itself, and
    hidden with LANGSMITH_HIDE_INPUTS/OUTPUTS where it must not be."""
    metadata: dict[str, Any] = {
        "agent": context.agent,
        "entrypoint": entrypoint,
        "user_id": context.user_id,
        "organization_id": context.organization_id,
        "delegation_depth": context.depth,
    }
    config: RunnableConfig = {
        "run_name": context.agent,
        "tags": [f"agent:{context.agent}", f"entrypoint:{entrypoint}"],
        "metadata": metadata,
    }
    if thread_key is not None:
        # LangSmith groups a conversation's traces by `thread_id` metadata.
        metadata["thread_id"] = thread_key
        config["configurable"] = {"thread_id": thread_key}
    return config

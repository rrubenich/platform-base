"""Every registered agent's graph, for LangGraph Studio (`bun run studio`).

`langgraph.json` lists one function per agent (a test keeps both in step
with the registry). Set each run's context in Studio (user_id,
organization_id, agent) the way apps/api's token would: tools and
delegations read the caller from it.
"""

from langchain_core.runnables import RunnableConfig

# Absolute imports: Studio loads this file by path, outside its package.
from agents_service.agents import REGISTRY
from agents_service.config import get_settings
from agents_service.llm import chat_model
from agents_service.platform import AgentContext, Graph
from agents_service.platform.runtime import Platform

__all__ = ["AgentContext", "assistant", "docs"]


def platform() -> Platform:
    settings = get_settings()
    return Platform(
        registry=REGISTRY,
        settings=settings,
        model_for=lambda _agent: chat_model(settings.llm_model),
        # Studio's server saves threads itself.
        checkpointer=None,
    )


def build(name: str) -> Graph:
    # Persistent with no checkpointer of ours: Studio's server saves threads.
    return platform().graph(name, persistent=True)


def assistant(config: RunnableConfig) -> Graph:
    return build("assistant")


def docs(config: RunnableConfig) -> Graph:
    return build("docs")

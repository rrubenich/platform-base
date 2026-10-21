"""Agents that exist only for the platform's tests."""

from typing import Any

from langchain.tools import ToolRuntime, tool

from agents_service.platform import Agent, AgentContext, Registry, background


@tool
def whoami(runtime: ToolRuntime[AgentContext, Any]) -> str:
    """Says who the agent is running for."""
    context = runtime.context
    return f"{context.user_id}@{context.organization_id} via {context.agent}"


coordinator = Agent(
    name="coordinator",
    description="Coordinates work between agents.",
    instructions="You coordinate.",
    tools=[whoami],
    delegates=["researcher", background("reporter")],
    modes=frozenset({"chat", "job"}),
)
researcher = Agent(
    name="researcher",
    description="Finds facts about a topic.",
    instructions="You research.",
    tools=[whoami],
)
reporter = Agent(
    name="reporter",
    description="Writes long reports.",
    instructions="You write reports.",
    modes=frozenset({"job"}),
)
admin_tool = Agent(
    name="admin_tool",
    description="Platform-level helper.",
    instructions="You help admins.",
    audience="platform",
)

TEAM = Registry([coordinator, researcher, reporter, admin_tool])


def chain(length: int) -> Registry:
    """agent_0 asks agent_1 asks ... agent_{length-1}."""
    return Registry(
        Agent(
            name=f"agent_{i}",
            description=f"Link {i}.",
            instructions=f"You are link {i}.",
            delegates=[f"agent_{i + 1}"] if i + 1 < length else [],
        )
        for i in range(length)
    )

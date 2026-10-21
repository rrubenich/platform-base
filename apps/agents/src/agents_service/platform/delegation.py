# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""Agents calling agents, as tools.

For each delegate an agent declares, its model gets a tool:
- `ask_<name>(request)`: runs that agent now and returns its answer.
- `start_<name>(request)`: queues it as a background job, returns the id.

The delegate runs as the same user and organization (from the tool
runtime's context), one-off (nothing saved), and only its final answer
comes back: the user sees the delegation as a `tool` event, never the
delegate's own tokens.
"""

import logging
from dataclasses import replace
from typing import TYPE_CHECKING, Any

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from .agent import Agent, AgentContext
from .auth import MemberCaller

if TYPE_CHECKING:
    from .runtime import Platform

logger = logging.getLogger(__name__)

# Agents asking agents asking agents... The registry already rejects loops;
# this only bounds how deep a legitimate chain may go.
MAX_DELEGATION_DEPTH = 3


class DelegationRequest(BaseModel):
    request: str = Field(
        description=(
            "What you need, in plain language, with every detail it needs: "
            "it can't see this conversation."
        )
    )


def delegation_tools(platform: "Platform", agent: Agent) -> list[BaseTool]:
    registry = platform.registry
    return [
        *(_ask(platform, registry.get(name)) for name in agent.sync_delegates),
        *(_start(platform, registry.get(name)) for name in agent.background_delegates),
    ]


def _context(runtime: ToolRuntime[AgentContext, Any]) -> AgentContext:
    context = runtime.context
    if not isinstance(context, AgentContext):  # pyright: ignore[reportUnnecessaryIsInstance]
        # Every platform run passes one; only a misconfigured caller (a graph
        # invoked without `context=`) gets here.
        raise RuntimeError("agent run without an AgentContext")
    return context


def _ask(platform: "Platform", target: Agent) -> BaseTool:
    async def ask(request: str, runtime: ToolRuntime[AgentContext, Any]) -> str:
        context = _context(runtime)
        if context.depth + 1 > MAX_DELEGATION_DEPTH:
            return f"Can't ask the {target.name} agent: too many nested delegations."
        delegate = replace(context, agent=target.name, depth=context.depth + 1)
        try:
            return await platform.run(delegate, request, entrypoint="delegation")
        except Exception:
            # The parent model decides what to do next; the user's
            # conversation doesn't fail with it.
            logger.exception("delegation to %s failed", target.name)
            return f"The {target.name} agent failed."

    return _tool(ask, f"ask_{target.name}", target.description)


def _start(platform: "Platform", target: Agent) -> BaseTool:
    async def start(request: str, runtime: ToolRuntime[AgentContext, Any]) -> str:
        context = _context(runtime)
        if platform.queue is None or context.organization_id is None:
            return f"Can't start the {target.name} agent here."
        caller = MemberCaller(
            user_id=context.user_id, organization_id=context.organization_id
        )
        try:
            job_id = await platform.queue.enqueue(target.name, caller, request)
        except Exception:
            logger.exception("queueing %s failed", target.name)
            return f"Couldn't start the {target.name} agent."
        return f"Started the {target.name} agent in the background (job {job_id})."

    return _tool(
        start,
        f"start_{target.name}",
        f"Starts in the background, without waiting for it: {target.description}",
    )


def _tool(coroutine: Any, name: str, description: str) -> BaseTool:
    return StructuredTool.from_function(
        coroutine=coroutine,
        name=name,
        description=description,
        args_schema=DelegationRequest,
    )

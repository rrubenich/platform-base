"""What an agent is: one declaration the platform turns into a graph,
routes, jobs and the tools other agents use to reach it.

```python
agent = Agent(
    name="assistant",
    description="General help for organization members.",
    instructions=INSTRUCTIONS,
    tools=[lookup_something],
    delegates=["other_agent", background("reporter")],
)
```
"""

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from langchain_core.language_models import BaseChatModel

from ..config import Settings

if TYPE_CHECKING:
    from .chat import Graph

Audience = Literal["member", "platform"]
Mode = Literal["chat", "job"]

# Also the token scope, the route segment and the delegation tool's suffix.
NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")

# LangChain tools: `@tool` functions or `BaseTool` instances.
Tools = Sequence[Any]
# Tools that need configuration (a path, a client) receive the settings.
ToolSource = Tools | Callable[[Settings], Tools]


@dataclass(frozen=True)
class AgentContext:
    """Who an agent is running for, available to every tool through
    `ToolRuntime.context`. Never trust anything else to say who the user is.
    """

    user_id: str
    # The user's active organization; None for platform-level agents.
    organization_id: str | None
    # The agent running now; a delegate sees its own name.
    agent: str
    # 0 for the agent the user called, +1 per delegation.
    depth: int = 0


@dataclass(frozen=True)
class Background:
    """A delegate reached by queueing a job instead of waiting for it."""

    name: str


def background(name: str) -> Background:
    return Background(name)


@dataclass(frozen=True)
class BuildContext:
    """What a custom `graph` factory receives to build its graph."""

    model: BaseChatModel
    # The agent's own tools followed by its delegation tools.
    tools: list[Any]
    settings: Settings
    # Pass to `compile(checkpointer=...)`; None for one-off runs.
    checkpointer: Any


GraphFactory = Callable[[BuildContext], "Graph"]


@dataclass(frozen=True, kw_only=True)
class Agent:
    name: str
    description: str
    # The system prompt of a tool-calling agent; kept byte-for-byte stable so
    # it stays a cacheable prompt prefix. Exclusive with `graph`.
    instructions: str | None = None
    tools: ToolSource = ()
    # Agents this one may call: a name for an answer now (`ask_<name>`),
    # `background(name)` to queue a job (`start_<name>`).
    delegates: Sequence[str | Background] = ()
    # "member": the token must name an organization the user belongs to.
    # "platform": no organization (e.g. superadmin tools).
    audience: Audience = "member"
    modes: frozenset[Mode] = field(default_factory=lambda: frozenset({"chat"}))
    # A workflow beyond the tool-calling loop builds its own StateGraph,
    # compiled with `context_schema=AgentContext`. Exclusive with
    # `instructions`.
    graph: GraphFactory | None = None

    def __post_init__(self) -> None:
        if not NAME_PATTERN.match(self.name):
            raise ValueError(f"agent name {self.name!r} must match {NAME_PATTERN}")
        if not self.description.strip():
            raise ValueError(f"agent {self.name!r} needs a description")
        if (self.instructions is None) == (self.graph is None):
            raise ValueError(
                f"agent {self.name!r} needs exactly one of instructions or graph"
            )
        if not self.modes:
            raise ValueError(f"agent {self.name!r} must offer chat, job or both")
        if "job" in self.modes and self.audience != "member":
            # Jobs are visible per organization, so they need one.
            raise ValueError(f"agent {self.name!r}: jobs need the member audience")

    def resolve_tools(self, settings: Settings) -> list[Any]:
        source = self.tools
        return list(source(settings) if callable(source) else source)

    @property
    def sync_delegates(self) -> list[str]:
        return [d for d in self.delegates if isinstance(d, str)]

    @property
    def background_delegates(self) -> list[str]:
        return [d.name for d in self.delegates if isinstance(d, Background)]

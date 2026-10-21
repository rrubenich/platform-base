# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportIncompatibleMethodOverride=false
"""Test harness for agents: run any registered agent through the real
platform (graph, tools, delegation, threads, streaming) on a scripted model.

```python
harness = AgentHarness(REGISTRY, models={
    "assistant": ScriptedModel(call("lookup", query="x"), reply("Found it.")),
})
transcript = await harness.chat("assistant", "Find x")
assert transcript.tool_calls == [("lookup", {"query": "x"})]
assert transcript.text == "Found it."
```

The model is the only fake: what it says is scripted, everything the agent
does with it is real. `ScriptedModel.requests` keeps what the agent sent the
model (messages and tool names), so tests can check prompts and context.
"""

import json
from collections.abc import AsyncIterator, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from langchain_core.callbacks import (
    AsyncCallbackManagerForLLMRun,
    CallbackManagerForLLMRun,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import ConfigDict, PrivateAttr

from .config import Settings, get_settings
from .platform import AgentContext, Registry
from .platform.auth import MemberCaller
from .platform.chat import Delta, Error, StreamEvent, Thread, ToolUse
from .platform.jobs import JobView
from .platform.runtime import Platform


def reply(text: str) -> AIMessage:
    """A scripted model turn that answers with `text`."""
    return AIMessage(text)


def call(tool: str, /, **args: Any) -> AIMessage:
    """A scripted model turn that calls `tool` with `args`."""
    return calls((tool, args))


def calls(*tool_calls: tuple[str, dict[str, Any]]) -> AIMessage:
    """A scripted model turn that calls several tools at once."""
    return AIMessage(
        "",
        tool_calls=[
            {"name": name, "args": args, "id": f"call-{uuid4().hex[:8]}"}
            for name, args in tool_calls
        ],
    )


@dataclass(frozen=True)
class ModelRequest:
    """One call the agent made to the model."""

    messages: list[BaseMessage]
    # Names of the tools bound to the model when it was called.
    tools: list[str]

    @property
    def system(self) -> str:
        first = self.messages[0] if self.messages else None
        return first.text if first is not None and first.type == "system" else ""


class ScriptExhaustedError(AssertionError):
    pass


class ScriptedModel(BaseChatModel):
    """A chat model that plays `script` back turn by turn, supports tools
    like a real one, and records every request. Each script item is a
    message (see `reply`/`call`) or an exception to raise, e.g. a provider
    outage."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    _script: list[AIMessage | Exception] = PrivateAttr(default_factory=list)
    _requests: list[ModelRequest] = PrivateAttr(default_factory=list)
    _tools: list[str] = PrivateAttr(default_factory=list)
    _shared: "ScriptedModel | None" = PrivateAttr(default=None)

    def __init__(self, *script: AIMessage | Exception, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        # Private, so pydantic keeps scripted exceptions as they are.
        self._script = list(script)

    @property
    def _llm_type(self) -> str:
        return "scripted"

    @property
    def requests(self) -> list[ModelRequest]:
        return self._root._requests

    @property
    def remaining(self) -> int:
        """Script turns not played yet; 0 when the agent used them all."""
        return len(self._root._script)

    @property
    def _root(self) -> "ScriptedModel":
        return self._shared or self

    def bind_tools(self, tools: Sequence[Any], **kwargs: Any) -> "ScriptedModel":
        # A view onto the same script and records, knowing its tools.
        bound = ScriptedModel()
        bound._shared = self._root
        bound._tools = [_tool_name(tool) for tool in tools]
        return bound

    def _next(self, messages: list[BaseMessage]) -> AIMessage:
        root = self._root
        root._requests.append(ModelRequest(list(messages), list(self._tools)))
        if not root._script:
            raise ScriptExhaustedError(
                f"the agent called the model {len(root._requests)} times, "
                f"but only {len(root._requests) - 1} replies were scripted"
            )
        turn = root._script.pop(0)
        if isinstance(turn, Exception):
            raise turn
        return turn

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self._next(messages))])

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        yield _chunk(self._next(messages))

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        yield _chunk(self._next(messages))


def _tool_name(tool: Any) -> str:
    if isinstance(tool, dict):
        spec: dict[str, Any] = tool
        return str(spec.get("name") or spec.get("function", {}).get("name"))
    return str(getattr(tool, "name", tool))


def _chunk(message: AIMessage) -> ChatGenerationChunk:
    # One chunk per turn keeps tool calls whole (the stock fake models split
    # text into tokens and drop messages that only carry tool calls).
    return ChatGenerationChunk(
        message=AIMessageChunk(
            content=message.content,
            tool_call_chunks=[
                {
                    "name": tool_call["name"],
                    "args": json.dumps(tool_call["args"]),
                    "id": tool_call["id"],
                    "index": index,
                }
                for index, tool_call in enumerate(message.tool_calls)
            ],
        )
    )


@dataclass
class FakeQueue:
    """A job queue that records what was queued and serves canned views."""

    jobs: dict[str, tuple[MemberCaller, JobView]] = field(
        default_factory=dict[str, tuple[MemberCaller, JobView]]
    )
    enqueued: list[tuple[str, MemberCaller, str]] = field(
        default_factory=list[tuple[str, MemberCaller, str]]
    )

    async def enqueue(self, agent: str, caller: MemberCaller, prompt: str) -> str:
        self.enqueued.append((agent, caller, prompt))
        return f"job-{len(self.enqueued)}"

    async def get(self, job_id: str, caller: MemberCaller) -> JobView | None:
        owner, view = self.jobs.get(job_id, (None, None))
        if owner is None or owner.organization_id != caller.organization_id:
            return None
        return view


@dataclass(frozen=True)
class Transcript:
    """What the client saw during one chat turn."""

    events: list[StreamEvent]

    @property
    def thread_id(self) -> str:
        first = self.events[0]
        assert isinstance(first, Thread)  # noqa: S101
        return first.id

    @property
    def text(self) -> str:
        return "".join(e.text for e in self.events if isinstance(e, Delta))

    @property
    def tool_calls(self) -> list[tuple[str, dict[str, Any]]]:
        return [(e.name, e.args) for e in self.events if isinstance(e, ToolUse)]

    @property
    def error(self) -> Error | None:
        return next((e for e in self.events if isinstance(e, Error)), None)


class AgentHarness:
    """Runs registered agents through the real platform: the registry's
    definitions, an in-memory checkpointer and a `FakeQueue`. Every agent
    that runs, delegates included, needs a model in `models`."""

    def __init__(
        self,
        registry: Registry,
        *,
        models: Mapping[str, BaseChatModel],
        settings: Settings | None = None,
    ) -> None:
        self.registry = registry
        # Kept as given, so a test can add models after building the harness.
        self.models = models
        self.queue = FakeQueue()
        self.platform = Platform(
            registry=registry,
            settings=settings or get_settings(),
            model_for=self._model_for,
            checkpointer=InMemorySaver(),
            queue=self.queue,
        )

    def _model_for(self, agent: str) -> BaseChatModel:
        if agent not in self.models:
            raise AssertionError(f"no model scripted for agent {agent!r}")
        return self.models[agent]

    def context(
        self,
        agent: str,
        *,
        user_id: str = "user-1",
        organization_id: str | None = None,
    ) -> AgentContext:
        """The caller apps/api would send: members get `org-1` by default."""
        if organization_id is None and self.registry.get(agent).audience == "member":
            organization_id = "org-1"
        return AgentContext(
            user_id=user_id, organization_id=organization_id, agent=agent
        )

    async def chat(
        self,
        agent: str,
        message: str,
        *,
        thread_id: str | None = None,
        check: bool = True,
        **caller: Any,
    ) -> Transcript:
        """One chat turn. With `check`, an `error` event fails the test (the
        exception is in the captured log output)."""
        events = [
            event
            async for event in self.platform.chat(
                self.context(agent, **caller), message, thread_id or uuid4().hex
            )
        ]
        transcript = Transcript(events)
        if check and transcript.error is not None:
            raise AssertionError(
                f"{agent} ended its turn with an error event; see the log above"
            )
        return transcript

    async def thread(self, agent: str, thread_id: str, **caller: Any) -> list[Any]:
        messages = await self.platform.thread(self.context(agent, **caller), thread_id)
        return [(m.role, m.content) for m in messages]

    async def run(self, agent: str, prompt: str, **caller: Any) -> str:
        """A background run of `agent`, as the worker does it."""
        return await self.platform.run(
            self.context(agent, **caller), prompt, entrypoint="job"
        )

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""One router for every agent: `/v1/agents/{agent}/...`.

Each request needs a token apps/api issued for that agent (`scope`), an
organization when the agent is for members, and the agent must offer the
mode (chat or job) the route belongs to.
"""

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel, Field

from .agent import Agent, AgentContext, Mode
from .auth import CallerDep, MemberCaller
from .chat import (
    CHAT_EVENTS_DESCRIPTION,
    THREAD_ID_PATTERN,
    ChatMessage,
    ChatRequest,
)
from .jobs import JobQueue, JobView
from .registry import Registry
from .runtime import Platform


def get_platform(request: Request) -> Platform:
    return request.app.state.platform


PlatformDep = Annotated[Platform, Depends(get_platform)]


@dataclass(frozen=True)
class Access:
    agent: Agent
    context: AgentContext

    def member(self) -> MemberCaller:
        # Only reached for member agents, whose access requires an org.
        assert self.context.organization_id is not None  # noqa: S101
        return MemberCaller(
            user_id=self.context.user_id,
            organization_id=self.context.organization_id,
        )


class JobRequest(BaseModel):
    prompt: str = Field(min_length=1)


class JobCreated(BaseModel):
    id: str


class ThreadView(BaseModel):
    id: str
    messages: list[ChatMessage]


def _queue(platform: Platform) -> JobQueue:
    if platform.queue is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No job queue")
    return platform.queue


def create_router(registry: Registry) -> APIRouter:
    def access(
        caller: CallerDep,
        # Listed as an enum, so the OpenAPI schema (and apps/api's types)
        # name every agent.
        agent: Annotated[str, Path(json_schema_extra={"enum": registry.names()})],
    ) -> Access:
        if agent not in registry:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"No agent {agent}")
        definition = registry.get(agent)
        if definition.name not in caller.scopes:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Token is not valid for {definition.name}"
            )
        if definition.audience == "member" and caller.organization_id is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No organization in token")
        return Access(
            definition,
            AgentContext(
                user_id=caller.user_id,
                organization_id=caller.organization_id,
                agent=definition.name,
            ),
        )

    def offering(mode: Mode) -> Callable[..., Access]:
        def dependency(granted: Annotated[Access, Depends(access)]) -> Access:
            if mode not in granted.agent.modes:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND,
                    f"{granted.agent.name} doesn't offer {mode}",
                )
            return granted

        return dependency

    chat_access = offering("chat")
    job_access = offering("job")

    router = APIRouter(prefix="/v1/agents/{agent}", tags=["agents"])

    @router.post(
        "/chat",
        response_class=EventSourceResponse,
        summary="Chat with an agent, streamed as server-sent events",
        description=CHAT_EVENTS_DESCRIPTION,
    )
    async def chat(
        body: ChatRequest,
        granted: Annotated[Access, Depends(chat_access)],
        platform: PlatformDep,
    ) -> AsyncIterator[ServerSentEvent]:
        thread_id = body.thread_id or uuid4().hex
        async for event in platform.chat(granted.context, body.message, thread_id):
            yield ServerSentEvent(event=event.type, data=event)

    @router.get(
        "/threads/{thread_id}",
        summary="A conversation's messages, to reopen it",
        responses={404: {"description": "No such thread for this caller"}},
    )
    async def get_thread(
        thread_id: Annotated[str, Path(pattern=THREAD_ID_PATTERN)],
        granted: Annotated[Access, Depends(chat_access)],
        platform: PlatformDep,
    ) -> ThreadView:
        messages = await platform.thread(granted.context, thread_id)
        if not messages:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
        return ThreadView(id=thread_id, messages=messages)

    @router.post(
        "/jobs",
        status_code=status.HTTP_202_ACCEPTED,
        summary="Run an agent in the background",
    )
    async def create_job(
        body: JobRequest,
        granted: Annotated[Access, Depends(job_access)],
        platform: PlatformDep,
    ) -> JobCreated:
        queue = _queue(platform)
        job_id = await queue.enqueue(granted.agent.name, granted.member(), body.prompt)
        return JobCreated(id=job_id)

    @router.get(
        "/jobs/{job_id}",
        summary="A background job's status and result",
        responses={404: {"description": "No such job in the caller's organization"}},
    )
    async def get_job(
        job_id: str,
        granted: Annotated[Access, Depends(job_access)],
        platform: PlatformDep,
    ) -> JobView:
        job = await _queue(platform).get(job_id, granted.member())
        # A token for one agent doesn't reveal another agent's jobs.
        if job is None or job.agent != granted.agent.name:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        return job

    return router

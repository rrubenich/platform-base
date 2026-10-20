from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel, Field

from ..agents import assistant
from ..agents.chat import CHAT_EVENTS_DESCRIPTION, ChatRequest, stream_graph
from ..auth import Caller, MemberCaller, as_member, require_scope
from ..dependencies import ChatModelDep, JobQueueDep
from ..jobs import JobView

router = APIRouter(
    prefix="/v1/assistant",
    tags=["assistant"],
    # Every route needs a token apps/api issued for this agent.
    dependencies=[Depends(require_scope("assistant"))],
)


def member(
    caller: Annotated[Caller, Depends(require_scope("assistant"))],
) -> MemberCaller:
    return as_member(caller)


MemberDep = Annotated[MemberCaller, Depends(member)]


@router.post(
    "/chat",
    response_class=EventSourceResponse,
    summary="Chat with the assistant, streamed as server-sent events",
    description=CHAT_EVENTS_DESCRIPTION,
)
async def chat(
    body: ChatRequest, model: ChatModelDep, _caller: MemberDep
) -> AsyncIterator[ServerSentEvent]:
    async for event in stream_graph(assistant.build(model), body.messages):
        yield ServerSentEvent(event=event.type, data=event)


class JobRequest(BaseModel):
    prompt: str = Field(min_length=1)


class JobCreated(BaseModel):
    id: str


@router.post(
    "/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Run the assistant in the background",
)
async def create_job(
    body: JobRequest, caller: MemberDep, queue: JobQueueDep
) -> JobCreated:
    job_id = await queue.enqueue("run_assistant", caller, prompt=body.prompt)
    return JobCreated(id=job_id)


@router.get(
    "/jobs/{job_id}",
    summary="A background job's status and result",
    responses={404: {"description": "No such job in the caller's organization"}},
)
async def get_job(job_id: str, caller: MemberDep, queue: JobQueueDep) -> JobView:
    job = await queue.get(job_id, caller)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel, Field, model_validator

from ..agents import assistant
from ..dependencies import (
    CallerDep,
    ChatModelDep,
    JobQueueDep,
    require_service_token,
)
from ..jobs import JobView

router = APIRouter(
    prefix="/v1/assistant",
    tags=["assistant"],
    dependencies=[Depends(require_service_token)],
)


class ChatRequest(BaseModel):
    messages: list[assistant.ChatMessage] = Field(min_length=1)

    @model_validator(mode="after")
    def ends_with_user(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


@router.post(
    "/chat",
    response_class=EventSourceResponse,
    summary="Chat with the assistant, streamed as server-sent events",
    description=(
        "Events: `delta` (`{text}`) as the reply is written, then `done` "
        "or `error` (`{code, message}`)."
    ),
)
async def chat(
    body: ChatRequest, model: ChatModelDep, _caller: CallerDep
) -> AsyncIterator[ServerSentEvent]:
    async for event in assistant.stream_reply(model, body.messages):
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
    body: JobRequest, caller: CallerDep, queue: JobQueueDep
) -> JobCreated:
    job_id = await queue.enqueue("run_assistant", caller, prompt=body.prompt)
    return JobCreated(id=job_id)


@router.get(
    "/jobs/{job_id}",
    summary="A background job's status and result",
    responses={404: {"description": "No such job in the caller's organization"}},
)
async def get_job(job_id: str, caller: CallerDep, queue: JobQueueDep) -> JobView:
    job = await queue.get(job_id, caller)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.sse import EventSourceResponse, ServerSentEvent

from ..agents import docs
from ..agents.chat import CHAT_EVENTS_DESCRIPTION, ChatRequest, stream_graph
from ..auth import require_scope
from ..dependencies import ChatModelDep, DocsLibraryDep

router = APIRouter(
    prefix="/v1/docs",
    tags=["docs"],
    # apps/api only issues this scope to superadmins; no organization needed.
    dependencies=[Depends(require_scope("docs"))],
)


@router.post(
    "/chat",
    response_class=EventSourceResponse,
    summary="Ask how Platform Base is built, answered from the project's docs (SSE)",
    description=CHAT_EVENTS_DESCRIPTION,
)
async def chat(
    body: ChatRequest, model: ChatModelDep, library: DocsLibraryDep
) -> AsyncIterator[ServerSentEvent]:
    async for event in stream_graph(docs.build(model, library), body.messages):
        yield ServerSentEvent(event=event.type, data=event)

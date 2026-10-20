import os
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass, field
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

# Settings are read on first use; give them the required values before any
# app module is imported.
os.environ.setdefault("AGENTS_SERVICE_TOKEN", "test-token")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

from agents_service.dependencies import get_chat_model, get_job_queue
from agents_service.jobs import Caller, JobView
from agents_service.main import create_app

AUTH = {
    "X-Service-Token": "test-token",
    "X-User-Id": "user-1",
    "X-Organization-Id": "org-1",
}


class FailingChatModel(GenericFakeChatModel):
    """A chat model whose provider call always fails, e.g. a bad API key."""

    async def _astream(self, *args: Any, **kwargs: Any) -> AsyncIterator[Any]:
        raise RuntimeError("401 invalid api key")
        yield  # pragma: no cover - makes this an async generator


@dataclass
class FakeQueue:
    jobs: dict[str, tuple[Caller, JobView]] = field(
        default_factory=dict[str, tuple[Caller, JobView]]
    )
    enqueued: list[tuple[str, Caller, dict[str, Any]]] = field(
        default_factory=list[tuple[str, Caller, dict[str, Any]]]
    )

    async def enqueue(self, agent: str, caller: Caller, **inputs: Any) -> str:
        self.enqueued.append((agent, caller, inputs))
        return "job-1"

    async def get(self, job_id: str, caller: Caller) -> JobView | None:
        owner, view = self.jobs.get(job_id, (None, None))
        if owner is None or owner.organization_id != caller.organization_id:
            return None
        return view


@pytest.fixture
def model() -> BaseChatModel:
    """Replies "Olá, tudo bem?"; tests swap it to script other answers."""
    return GenericFakeChatModel(messages=iter([AIMessage("Olá, tudo bem?")]))


@pytest.fixture
def queue() -> FakeQueue:
    return FakeQueue()


@pytest.fixture
def client(model: BaseChatModel, queue: FakeQueue) -> Iterator[TestClient]:
    # Not entered as a context manager, so the lifespan (real Redis) never
    # runs. The real agent graph runs, on a fake chat model.
    app = create_app()
    app.dependency_overrides[get_chat_model] = lambda: model
    app.dependency_overrides[get_job_queue] = lambda: queue
    yield TestClient(app)

import json
import os
import time
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass, field
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk

# apps/api's signing key, generated per test run. Settings are read on first
# use, so the public half is in the env before any app module is imported.
SIGNING_KEY = Ed25519PrivateKey.generate()
os.environ["AGENTS_JWT_PUBLIC_KEY"] = (
    SIGNING_KEY.public_key()
    .public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    .decode()
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

from agents_service.auth import MemberCaller  # noqa: E402
from agents_service.dependencies import get_chat_model, get_job_queue  # noqa: E402
from agents_service.jobs import JobView  # noqa: E402
from agents_service.main import create_app  # noqa: E402


def make_token(key: Ed25519PrivateKey = SIGNING_KEY, **overrides: Any) -> str:
    """A token as apps/api signs it; `overrides` replace or (None) drop claims."""
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": "platform-base-api",
        "aud": "platform-base-agents",
        "sub": "user-1",
        "org": "org-1",
        "scope": "assistant",
        "iat": now,
        "exp": now + 60,
    }
    claims.update(overrides)
    claims = {name: value for name, value in claims.items() if value is not None}
    return jwt.encode(claims, key, algorithm="EdDSA")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


AUTH = bearer(make_token())


class ToolCallingFakeModel(GenericFakeChatModel):
    """Plays back scripted messages, tool calls included, like a real model
    that supports tools (GenericFakeChatModel refuses `bind_tools`)."""

    def bind_tools(self, tools: Any, **kwargs: Any) -> "ToolCallingFakeModel":
        return self

    def _stream(self, *args: Any, **kwargs: Any) -> Iterator[ChatGenerationChunk]:
        # The parent splits text into tokens and drops messages that only
        # carry tool calls; one chunk per scripted message keeps both.
        message = next(self.messages)
        assert isinstance(message, AIMessage)
        yield ChatGenerationChunk(
            message=AIMessageChunk(
                content=message.content,
                tool_call_chunks=[
                    {
                        "name": call["name"],
                        "args": json.dumps(call["args"]),
                        "id": call["id"],
                        "index": index,
                    }
                    for index, call in enumerate(getattr(message, "tool_calls", []))
                ],
            )
        )


class FailingChatModel(GenericFakeChatModel):
    """A chat model whose provider call always fails, e.g. a bad API key."""

    async def _astream(self, *args: Any, **kwargs: Any) -> AsyncIterator[Any]:
        raise RuntimeError("401 invalid api key")
        yield  # pragma: no cover - makes this an async generator


@dataclass
class FakeQueue:
    jobs: dict[str, tuple[MemberCaller, JobView]] = field(
        default_factory=dict[str, tuple[MemberCaller, JobView]]
    )
    enqueued: list[tuple[str, MemberCaller, dict[str, Any]]] = field(
        default_factory=list[tuple[str, MemberCaller, dict[str, Any]]]
    )

    async def enqueue(self, agent: str, caller: MemberCaller, **inputs: Any) -> str:
        self.enqueued.append((agent, caller, inputs))
        return "job-1"

    async def get(self, job_id: str, caller: MemberCaller) -> JobView | None:
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

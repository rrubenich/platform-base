import json
import os
import time
from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel

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
# Tests never send traces, whatever the developer's .env says.
os.environ["LANGSMITH_TRACING"] = "false"
os.environ.pop("AGENTS_DATABASE_URL", None)

from agents_service.agents import REGISTRY  # noqa: E402
from agents_service.main import create_app  # noqa: E402
from agents_service.platform import Registry  # noqa: E402
from agents_service.platform.routes import get_platform  # noqa: E402
from agents_service.testing import AgentHarness, ScriptedModel, reply  # noqa: E402


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


def sse_events(body: str) -> list[tuple[str, Any]]:
    events: list[tuple[str, Any]] = []
    for frame in body.strip().split("\n\n"):
        fields = dict(
            line.split(": ", 1) for line in frame.splitlines() if ": " in line
        )
        if "event" in fields:
            events.append((fields["event"], json.loads(fields["data"])))
    return events


@pytest.fixture
def registry() -> Registry:
    """The registry under test; platform tests swap in their own agents."""
    return REGISTRY


@pytest.fixture
def models() -> dict[str, BaseChatModel]:
    """One scripted model per agent; tests replace entries to script more."""
    return {"assistant": ScriptedModel(reply("Olá, tudo bem?"))}


@pytest.fixture
def harness(registry: Registry, models: dict[str, BaseChatModel]) -> AgentHarness:
    return AgentHarness(registry, models=models)


@pytest.fixture
def client(registry: Registry, harness: AgentHarness) -> Iterator[TestClient]:
    # Not entered as a context manager, so the lifespan (Redis, Postgres)
    # never runs: the routes use the harness's platform.
    app = create_app(registry)
    app.dependency_overrides[get_platform] = lambda: harness.platform
    yield TestClient(app)

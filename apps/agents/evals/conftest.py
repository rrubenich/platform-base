"""Evals: agents on the real model, graded, and recorded in LangSmith.

`bun run eval` (never part of `bun run test`). Needs the provider's key for
LLM_MODEL; with LANGSMITH_API_KEY too, each run lands in LangSmith as an
experiment of the `platform-base-agents` suite, comparable run over run. Without it,
the evals still run and grade locally.

Every eval shares one event loop (set in the `eval` script): provider
integrations cache their async HTTP clients per process, which a loop per
test would leave pointing at a closed loop.

Cases are small and pointed: one behavior each, graded deterministically
where possible (tools used, files cited) and by `judge` otherwise.
"""

import os
from collections.abc import Iterator

import pytest
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from agents_service.agents import REGISTRY
from agents_service.config import get_settings
from agents_service.testing import AgentHarness

os.environ.setdefault("LANGSMITH_TEST_SUITE", "platform-base-agents")
if not os.environ.get("LANGSMITH_API_KEY"):
    os.environ["LANGSMITH_TEST_TRACKING"] = "false"

# Each provider's integration reads its own key.
PROVIDER_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google_genai": "GOOGLE_API_KEY",
}


@pytest.fixture
def model() -> Iterator[BaseChatModel]:
    model_id = get_settings().llm_model
    key = PROVIDER_KEYS.get(model_id.split(":", 1)[0])
    if key and not os.environ.get(key):
        pytest.skip(f"{key} is not set; evals need the real model ({model_id})")
    yield init_chat_model(model_id)


@pytest.fixture
def harness(model: BaseChatModel) -> AgentHarness:
    """The real platform on the real model, for every agent."""
    return AgentHarness(REGISTRY, models={agent.name: model for agent in REGISTRY})

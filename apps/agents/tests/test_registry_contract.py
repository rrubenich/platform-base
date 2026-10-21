"""The contract every registered agent must meet, checked for each one.

Registering an agent puts it under these tests with nothing else to write:
it builds, binds exactly its tools and delegations, serves its modes over
HTTP for the right token only, keeps its threads, and runs as a job when it
says it does. Its own behavior goes in `tests/agents/<name>/`.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel

from agents_service.agents import REGISTRY
from agents_service.config import get_settings
from agents_service.platform import Agent
from agents_service.testing import AgentHarness, ScriptedModel, reply

from .conftest import bearer, make_token, sse_events

AGENTS = list(REGISTRY)
CHAT_AGENTS = [agent for agent in AGENTS if "chat" in agent.modes]
JOB_AGENTS = [agent for agent in AGENTS if "job" in agent.modes]


def ids(agent: Agent) -> str:
    return agent.name


def token_for(agent: Agent, **claims: Any) -> dict[str, str]:
    org = "org-1" if agent.audience == "member" else None
    return bearer(make_token(**{"scope": agent.name, "org": org, **claims}))


@pytest.fixture
def models() -> dict[str, BaseChatModel]:
    # Every agent answers each turn; delegates included, should they run.
    return {
        agent.name: ScriptedModel(*(reply(f"{agent.name} {n}") for n in range(4)))
        for agent in AGENTS
    }


def test_the_registry_is_not_empty() -> None:
    assert AGENTS


@pytest.mark.parametrize("agent", AGENTS, ids=ids)
async def test_binds_exactly_its_tools_and_delegations(
    agent: Agent, harness: AgentHarness, models: dict[str, ScriptedModel]
) -> None:
    expected = (
        [tool.name for tool in agent.resolve_tools(get_settings())]
        + [f"ask_{name}" for name in agent.sync_delegates]
        + [f"start_{name}" for name in agent.background_delegates]
    )

    await harness.chat(agent.name, "Oi")

    assert models[agent.name].requests[0].tools == expected


@pytest.mark.parametrize("agent", AGENTS, ids=ids)
def test_has_a_description_other_agents_can_use(agent: Agent) -> None:
    # It becomes the `ask_<name>` tool description: say what it's for.
    assert len(agent.description.split()) >= 5


@pytest.mark.parametrize("agent", CHAT_AGENTS, ids=ids)
def test_chats_over_http_and_keeps_the_thread(agent: Agent, client: TestClient) -> None:
    url = f"/v1/agents/{agent.name}/chat"
    headers = token_for(agent)

    first = sse_events(client.post(url, json={"message": "Oi"}, headers=headers).text)
    thread_id = first[0][1]["id"]
    client.post(url, json={"message": "E aí?", "thread_id": thread_id}, headers=headers)

    assert first[0][0] == "thread"
    assert first[-1] == ("done", {"type": "done"})
    history = client.get(
        f"/v1/agents/{agent.name}/threads/{thread_id}", headers=headers
    )
    assert [m["content"] for m in history.json()["messages"]] == [
        "Oi",
        f"{agent.name} 0",
        "E aí?",
        f"{agent.name} 1",
    ]


@pytest.mark.parametrize("agent", AGENTS, ids=ids)
def test_only_answers_tokens_issued_for_it(agent: Agent, client: TestClient) -> None:
    mode = "chat" if "chat" in agent.modes else "jobs"
    url = f"/v1/agents/{agent.name}/{mode}"
    body = {"message": "Oi"} if mode == "chat" else {"prompt": "Oi"}

    assert (
        client.post(url, json=body, headers=token_for(agent, scope="other")).status_code
        == 403
    )
    assert client.post(url, json=body).status_code == 401
    if agent.audience == "member":
        assert (
            client.post(url, json=body, headers=token_for(agent, org=None)).status_code
            == 403
        )


@pytest.mark.parametrize("agent", AGENTS, ids=ids)
def test_serves_only_the_modes_it_offers(agent: Agent, client: TestClient) -> None:
    headers = token_for(agent)

    chat = client.post(
        f"/v1/agents/{agent.name}/chat", json={"message": "Oi"}, headers=headers
    )
    job = client.post(
        f"/v1/agents/{agent.name}/jobs", json={"prompt": "Oi"}, headers=headers
    )

    assert (chat.status_code == 200) == ("chat" in agent.modes)
    assert (job.status_code == 202) == ("job" in agent.modes)


@pytest.mark.parametrize("agent", JOB_AGENTS, ids=ids)
async def test_runs_as_a_job(agent: Agent, harness: AgentHarness) -> None:
    assert await harness.run(agent.name, "Resuma") == f"{agent.name} 0"

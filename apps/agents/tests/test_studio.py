import json
from pathlib import Path

import pytest

from agents_service import studio
from agents_service.agents import REGISTRY
from agents_service.testing import ScriptedModel, reply

LANGGRAPH_JSON = Path(__file__).resolve().parents[1] / "langgraph.json"


def test_studio_lists_every_registered_agent() -> None:
    graphs = json.loads(LANGGRAPH_JSON.read_text())["graphs"]

    assert sorted(graphs) == sorted(REGISTRY.names())
    for name, target in graphs.items():
        assert target == f"./src/agents_service/studio.py:{name}"


@pytest.mark.parametrize("name", REGISTRY.names())
async def test_each_studio_graph_runs_its_agent(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        studio, "chat_model", lambda _model_id: ScriptedModel(reply("ok"))
    )
    graph = getattr(studio, name)({})
    org = "org-1" if REGISTRY.get(name).audience == "member" else None

    result = await graph.ainvoke(
        {"messages": [{"role": "user", "content": "Oi"}]},
        context=studio.AgentContext(user_id="dev", organization_id=org, agent=name),
    )

    assert result["messages"][-1].text == "ok"

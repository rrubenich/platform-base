import pytest

from agents_service.platform import AgentContext
from agents_service.platform.jobs import JOB_FUNCTION
from agents_service.platform.runtime import run_config
from agents_service.testing import AgentHarness, ScriptedModel, reply
from agents_service.worker import WorkerSettings, run_agent

from .agents import TEAM


def test_labels_runs_for_langsmith() -> None:
    context = AgentContext(user_id="ana", organization_id="org-1", agent="helper")

    config = run_config(context, "chat", thread_key="org-1:ana:helper:t1")

    assert dict(config) == {
        "run_name": "helper",
        "tags": ["agent:helper", "entrypoint:chat"],
        "metadata": {
            "agent": "helper",
            "entrypoint": "chat",
            "user_id": "ana",
            "organization_id": "org-1",
            "delegation_depth": 0,
            "thread_id": "org-1:ana:helper:t1",
        },
        "configurable": {"thread_id": "org-1:ana:helper:t1"},
    }


def test_one_off_runs_have_no_thread() -> None:
    context = AgentContext(user_id="ana", organization_id="org-1", agent="helper")

    assert "configurable" not in run_config(context, "job")


async def test_a_job_runs_the_agent_it_names_for_whoever_queued_it() -> None:
    model = ScriptedModel(reply("Relatório pronto."))
    harness = AgentHarness(TEAM, models={"reporter": model})

    result = await run_agent(
        {"platform": harness.platform},
        agent="reporter",
        prompt="Faça o relatório",
        user_id="ana",
        organization_id="org-1",
    )

    assert result == {"text": "Relatório pronto."}
    assert model.requests[0].messages[-1].text == "Faça o relatório"


async def test_a_failing_job_raises_so_arq_records_it() -> None:
    harness = AgentHarness(
        TEAM, models={"reporter": ScriptedModel(RuntimeError("outage"))}
    )

    with pytest.raises(RuntimeError, match="outage"):
        await run_agent(
            {"platform": harness.platform},
            agent="reporter",
            prompt="x",
            user_id="ana",
            organization_id="org-1",
        )


def test_the_worker_runs_the_queued_job_function() -> None:
    assert [f.__name__ for f in WorkerSettings.functions] == [JOB_FUNCTION]

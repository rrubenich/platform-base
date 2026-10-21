"""arq worker for background agent jobs.

Run with `uv run arq agents_service.worker.WorkerSettings` (or `bun run dev`).

Every agent's jobs run through `run_agent`; which agents may run as jobs is
their definition's business (`modes`), checked when the job is queued.
"""

from typing import Any, ClassVar

from arq.connections import RedisSettings

from .agents import REGISTRY
from .config import get_settings
from .llm import chat_model
from .platform import AgentContext
from .platform.jobs import ArqJobQueue
from .platform.runtime import Platform

settings = get_settings()


async def startup(ctx: dict[str, Any]) -> None:
    ctx["platform"] = Platform(
        registry=REGISTRY,
        settings=settings,
        model_for=lambda _agent: chat_model(settings.llm_model),
        # Jobs are one-off runs: nothing to persist.
        checkpointer=None,
        # A job's agent may start other agents in the background.
        queue=ArqJobQueue(ctx["redis"], settings.agents_queue_name),
    )


# Named as JOB_FUNCTION in platform/jobs.py, which queues it.
async def run_agent(
    ctx: dict[str, Any],
    *,
    agent: str,
    prompt: str,
    user_id: str,
    organization_id: str,
) -> dict[str, Any]:
    """Errors propagate so arq records the job as failed."""
    platform: Platform = ctx["platform"]
    context = AgentContext(
        user_id=user_id, organization_id=organization_id, agent=agent
    )
    return {"text": await platform.run(context, prompt, entrypoint="job")}


class WorkerSettings:
    functions: ClassVar = [run_agent]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    queue_name = settings.agents_queue_name
    keep_result = settings.agents_job_result_ttl
    # Agent turns can run for minutes; arq's default is 5.
    job_timeout = 15 * 60
    max_tries = 1

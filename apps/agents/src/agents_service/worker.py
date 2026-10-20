"""arq worker for background agent jobs.

Run with `uv run arq agents_service.worker.WorkerSettings` (or `bun run dev`).

Each function name is what `JobQueue.enqueue` receives as `agent`; every
job also gets the `user_id` and `organization_id` of whoever queued it.
"""

from typing import Any, ClassVar

from arq.connections import RedisSettings

from .agents import assistant
from .config import get_settings
from .llm import chat_model

settings = get_settings()


async def run_assistant(
    ctx: dict[str, Any], *, prompt: str, user_id: str, organization_id: str
) -> dict[str, Any]:
    output = await assistant.run(chat_model(settings.llm_model), prompt)
    return output.model_dump()


class WorkerSettings:
    functions: ClassVar = [run_assistant]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    queue_name = settings.agents_queue_name
    keep_result = settings.agents_job_result_ttl
    # Agent turns can run for minutes; arq's default is 5.
    job_timeout = 15 * 60
    max_tries = 1

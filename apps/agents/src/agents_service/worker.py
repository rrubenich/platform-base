"""arq worker for background agent jobs.

Run with `uv run arq agents_service.worker.WorkerSettings` (or `bun run dev`).

The job functions live with their agent (`agents/<name>/jobs.py`) and are
collected in `agents/__init__.py`.
"""

from typing import ClassVar

from arq.connections import RedisSettings

from .agents import JOBS
from .config import get_settings

settings = get_settings()


class WorkerSettings:
    functions: ClassVar = list(JOBS)
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    queue_name = settings.agents_queue_name
    keep_result = settings.agents_job_result_ttl
    # Agent turns can run for minutes; arq's default is 5.
    job_timeout = 15 * 60
    max_tries = 1

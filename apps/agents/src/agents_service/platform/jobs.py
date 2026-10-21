"""Background jobs on Redis (arq). The worker side lives in `worker.py`.

Every agent runs through one job function, `run_agent`, told which agent
and prompt to run; each job also records who queued it.
"""

from typing import Any, Literal, Protocol
from uuid import uuid4

from arq.connections import ArqRedis
from arq.jobs import Job, JobResult, JobStatus
from pydantic import BaseModel

from .auth import MemberCaller

# The arq function every job runs (see worker.py).
JOB_FUNCTION = "run_agent"


class JobView(BaseModel):
    id: str
    # The agent the job runs.
    agent: str
    status: Literal["queued", "running", "succeeded", "failed"]
    result: dict[str, Any] | None = None
    error: str | None = None


class JobQueue(Protocol):
    async def enqueue(self, agent: str, caller: MemberCaller, prompt: str) -> str: ...

    async def get(self, job_id: str, caller: MemberCaller) -> JobView | None: ...


class ArqJobQueue:
    def __init__(self, redis: ArqRedis, queue_name: str) -> None:
        self._redis = redis
        self._queue_name = queue_name

    async def enqueue(self, agent: str, caller: MemberCaller, prompt: str) -> str:
        job_id = uuid4().hex
        await self._redis.enqueue_job(
            JOB_FUNCTION,
            _job_id=job_id,
            _queue_name=self._queue_name,
            agent=agent,
            prompt=prompt,
            user_id=caller.user_id,
            organization_id=caller.organization_id,
        )
        return job_id

    async def get(self, job_id: str, caller: MemberCaller) -> JobView | None:
        """The job, or None when it doesn't exist or belongs to another org."""
        job = Job(job_id, self._redis, _queue_name=self._queue_name)
        status = await job.status()
        if status == JobStatus.not_found:
            return None
        info = await job.info()
        if info is None or info.kwargs.get("organization_id") != caller.organization_id:
            return None

        view = JobView(id=job_id, agent=info.kwargs.get("agent", ""), status="queued")
        if status == JobStatus.in_progress:
            view.status = "running"
        elif isinstance(info, JobResult):
            if info.success:
                view.status = "succeeded"
                view.result = info.result
            else:
                # The traceback is in the worker's logs; callers only learn
                # that it failed, never internal details.
                view.status = "failed"
                view.error = "The agent failed."
        return view

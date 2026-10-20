import pickle
import time

import fakeredis
import pytest
from arq.connections import ArqRedis
from arq.constants import result_key_prefix

from agents_service.auth import MemberCaller as Caller
from agents_service.jobs import ArqJobQueue

QUEUE = "agents:test"
ALICE = Caller(user_id="alice", organization_id="org-1")
BOB_ELSEWHERE = Caller(user_id="bob", organization_id="org-2")


@pytest.fixture
def redis() -> ArqRedis:
    return ArqRedis(connection_pool=fakeredis.FakeAsyncRedis().connection_pool)


async def test_a_queued_job_is_visible_to_its_organization_only(
    redis: ArqRedis,
) -> None:
    jobs = ArqJobQueue(redis, QUEUE)

    job_id = await jobs.enqueue("run_assistant", ALICE, prompt="Resuma")

    view = await jobs.get(job_id, Caller(user_id="carol", organization_id="org-1"))
    assert view is not None
    assert (view.agent, view.status) == ("run_assistant", "queued")
    assert await jobs.get(job_id, BOB_ELSEWHERE) is None


async def test_an_unknown_job_is_not_found(redis: ArqRedis) -> None:
    assert await ArqJobQueue(redis, QUEUE).get("nope", ALICE) is None


async def test_reports_a_finished_jobs_result(redis: ArqRedis) -> None:
    jobs = ArqJobQueue(redis, QUEUE)
    job_id = await jobs.enqueue("run_assistant", ALICE, prompt="Resuma")
    # What the arq worker writes when the function returns.
    now = int(time.time() * 1000)
    await redis.set(
        result_key_prefix + job_id,
        pickle.dumps(
            {
                "t": 1,
                "f": "run_assistant",
                "a": (),
                "k": {"prompt": "Resuma", **ALICE.__dict__},
                "et": now,
                "s": True,
                "r": {"text": "ok"},
                "st": now,
                "ft": now,
                "q": QUEUE,
            }
        ),
    )

    view = await jobs.get(job_id, ALICE)

    assert view is not None
    assert (view.status, view.result) == ("succeeded", {"text": "ok"})

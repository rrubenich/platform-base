"""The Postgres checkpointer against a real database.

Runs only when AGENTS_TEST_DATABASE_URL points at a disposable database
(e.g. a Neon branch, direct connection). Everything happens in a schema
created for the run and dropped after it, never in `langgraph`.
"""

import os
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from psycopg import AsyncConnection, sql

from agents_service.platform import threads
from agents_service.platform.runtime import Platform
from agents_service.testing import AgentHarness, ScriptedModel, reply

from ..platform.agents import TEAM

URL = os.environ.get("AGENTS_TEST_DATABASE_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not URL, reason="AGENTS_TEST_DATABASE_URL is not set"),
]


@pytest.fixture
async def schema(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[str]:
    assert URL
    name = f"langgraph_test_{uuid4().hex[:8]}"
    monkeypatch.setattr(threads, "SCHEMA", name)
    yield name
    async with await AsyncConnection.connect(URL, autocommit=True) as connection:
        await connection.execute(
            sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(name))
        )


async def test_threads_survive_a_new_process(schema: str) -> None:
    assert URL
    await threads.setup_checkpointer(URL)
    await threads.setup_checkpointer(URL)  # idempotent

    model = ScriptedModel(reply("Prazer, Ana."), reply("Você é a Ana."))
    async with threads.open_checkpointer(URL) as checkpointer:
        harness = AgentHarness(TEAM, models={"researcher": model})
        harness.platform = Platform(
            registry=TEAM,
            settings=harness.platform.settings,
            model_for=harness.platform.model_for,
            checkpointer=checkpointer,
        )
        await harness.chat("researcher", "Sou a Ana.", thread_id="t1")

    # A fresh pool, as after a restart: the thread is read back from Postgres.
    async with threads.open_checkpointer(URL) as checkpointer:
        harness.platform = Platform(
            registry=TEAM,
            settings=harness.platform.settings,
            model_for=harness.platform.model_for,
            checkpointer=checkpointer,
        )
        await harness.chat("researcher", "Quem sou eu?", thread_id="t1")

        assert await harness.thread("researcher", "t1") == [
            ("user", "Sou a Ana."),
            ("assistant", "Prazer, Ana."),
            ("user", "Quem sou eu?"),
            ("assistant", "Você é a Ana."),
        ]
        assert await harness.thread("researcher", "t1", user_id="eve") == []

    async with await AsyncConnection.connect(URL) as connection:
        cursor = await connection.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = %s",
            (schema,),
        )
        row = await cursor.fetchone()
        assert row is not None and row[0] > 0

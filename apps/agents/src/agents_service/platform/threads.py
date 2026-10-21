# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""Conversation threads: where they're stored and who owns them.

A chat's state is saved by a LangGraph checkpointer under a key derived
from the token, never taken from the client as is:
`{organization or "platform"}:{user}:{agent}:{thread_id}`. A user guessing
someone else's thread id only reaches an empty thread of their own.

The checkpoints live in Neon, in their own `langgraph` schema, created by
`bun run db:checkpoints` (the library's versioned `setup()`): the one set
of tables Drizzle doesn't migrate.
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection, sql
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .agent import AgentContext
from .chat import ChatMessage

logger = logging.getLogger(__name__)

SCHEMA = "langgraph"


def thread_key(context: AgentContext, thread_id: str) -> str:
    owner = context.organization_id or "platform"
    return f"{owner}:{context.user_id}:{context.agent}:{thread_id}"


def history(messages: list[BaseMessage]) -> list[ChatMessage]:
    """What the user saw: their messages and the agent's text replies, without
    tool traffic or the empty turns where the model only called tools."""
    shown: list[ChatMessage] = []
    for message in messages:
        if isinstance(message, HumanMessage):
            shown.append(ChatMessage(role="user", content=message.text))
        elif isinstance(message, AIMessage) and message.text:
            shown.append(ChatMessage(role="assistant", content=message.text))
    return shown


def _connection_kwargs() -> dict[str, Any]:
    # What AsyncPostgresSaver needs from every connection, plus our schema.
    return {
        "autocommit": True,
        "prepare_threshold": 0,
        "row_factory": dict_row,
        "options": f"-c search_path={SCHEMA}",
    }


@asynccontextmanager
async def open_checkpointer(
    database_url: str | None,
) -> AsyncGenerator[BaseCheckpointSaver[Any]]:
    """The process's checkpointer, open for as long as the context lasts."""
    if not database_url:
        logger.warning(
            "AGENTS_DATABASE_URL is not set: chat threads are kept in memory "
            "and lost on restart. Set it in every deployed environment."
        )
        yield InMemorySaver()
        return
    async with AsyncConnectionPool(
        database_url, kwargs=_connection_kwargs(), max_size=10, open=False
    ) as pool:
        yield AsyncPostgresSaver(pool)  # pyright: ignore[reportArgumentType]


async def setup_checkpointer(database_url: str) -> None:
    """Creates (or migrates) the checkpoint tables; safe to run repeatedly."""
    async with await AsyncConnection.connect(
        database_url, **_connection_kwargs()
    ) as connection:
        await connection.execute(
            sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(SCHEMA))
        )
        await AsyncPostgresSaver(connection).setup()  # pyright: ignore[reportArgumentType]

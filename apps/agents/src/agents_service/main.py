from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI

from .config import get_settings
from .jobs import ArqJobQueue
from .routers import assistant, docs, health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # One Redis pool for the whole process, shared through `dependencies.py`.
    settings = get_settings()
    redis = await create_pool(
        RedisSettings.from_dsn(settings.redis_url),
        default_queue_name=settings.agents_queue_name,
    )
    app.state.job_queue = ArqJobQueue(redis, settings.agents_queue_name)
    try:
        yield
    finally:
        await redis.aclose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Platform Base Agents",
        version="0.1.0",
        description="Internal service: only apps/api calls it.",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(assistant.router)
    app.include_router(docs.router)
    return app


app = create_app()

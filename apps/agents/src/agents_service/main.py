from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI

from . import health
from .agents import REGISTRY
from .config import get_settings
from .llm import chat_model
from .platform import Registry
from .platform.jobs import ArqJobQueue
from .platform.routes import create_router
from .platform.runtime import Platform
from .platform.threads import open_checkpointer


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # One Redis pool and one checkpointer for the whole process, shared by
    # every agent through the Platform.
    settings = get_settings()
    redis = await create_pool(
        RedisSettings.from_dsn(settings.redis_url),
        default_queue_name=settings.agents_queue_name,
    )
    try:
        async with open_checkpointer(settings.agents_database_url) as checkpointer:
            app.state.platform = Platform(
                registry=app.state.registry,
                settings=settings,
                model_for=lambda _agent: chat_model(settings.llm_model),
                checkpointer=checkpointer,
                queue=ArqJobQueue(redis, settings.agents_queue_name),
            )
            yield
    finally:
        await redis.aclose()


def create_app(registry: Registry = REGISTRY) -> FastAPI:
    app = FastAPI(
        title="Platform Base Agents",
        version="0.1.0",
        description="Internal service: only apps/api calls it.",
        lifespan=lifespan,
    )
    app.state.registry = registry
    app.include_router(health.router)
    app.include_router(create_router(registry))
    return app


app = create_app()

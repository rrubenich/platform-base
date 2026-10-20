from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"


# Unauthenticated so platform probes can reach it; it exposes nothing.
@router.get("/health", summary="Liveness check")
async def health() -> HealthStatus:
    return HealthStatus()

from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from langchain_core.language_models import BaseChatModel

from .config import Settings, get_settings
from .jobs import Caller, JobQueue
from .llm import chat_model

SettingsDep = Annotated[Settings, Depends(get_settings)]


def require_service_token(
    settings: SettingsDep,
    x_service_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.agents_service_token.get_secret_value()
    if x_service_token is None or not compare_digest(x_service_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid service token")


def get_caller(
    x_user_id: Annotated[str, Header()],
    x_organization_id: Annotated[str, Header()],
) -> Caller:
    return Caller(user_id=x_user_id, organization_id=x_organization_id)


def get_chat_model(settings: SettingsDep) -> BaseChatModel:
    return chat_model(settings.llm_model)


def get_job_queue(request: Request) -> JobQueue:
    return request.app.state.job_queue


CallerDep = Annotated[Caller, Depends(get_caller)]
ChatModelDep = Annotated[BaseChatModel, Depends(get_chat_model)]
JobQueueDep = Annotated[JobQueue, Depends(get_job_queue)]

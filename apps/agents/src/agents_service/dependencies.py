from typing import Annotated

from fastapi import Depends, Request
from langchain_core.language_models import BaseChatModel

from .agents.docs import DocsLibrary
from .config import Settings, get_settings
from .jobs import JobQueue
from .llm import chat_model

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_chat_model(settings: SettingsDep) -> BaseChatModel:
    return chat_model(settings.llm_model)


def get_docs_library(settings: SettingsDep) -> DocsLibrary:
    return DocsLibrary(settings.docs_root)


def get_job_queue(request: Request) -> JobQueue:
    return request.app.state.job_queue


ChatModelDep = Annotated[BaseChatModel, Depends(get_chat_model)]
DocsLibraryDep = Annotated[DocsLibrary, Depends(get_docs_library)]
JobQueueDep = Annotated[JobQueue, Depends(get_job_queue)]

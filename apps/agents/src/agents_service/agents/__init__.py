"""Every agent, one package each: its prompt and graph, its routes, its
background jobs and whatever else only it uses live in its folder.

Registering an agent here is what mounts its router (`main.py`) and gives
its jobs to the worker (`worker.py`).
"""

from fastapi import APIRouter

from . import assistant, docs

ROUTERS: list[APIRouter] = [assistant.router, docs.router]

# arq job functions, from every agent that runs in the background.
JOBS = [*assistant.JOBS]

"""Docs assistant for the admin console (token scope `docs`): explains how
Platform Base is built, answering from the repository's Markdown docs.

- `agent.py`: instructions and the LangGraph graph (`build`)
- `library.py`: the docs it may read, and the tools over them
- `router.py`: `/v1/docs` routes, chat over SSE
"""

from .router import router

__all__ = ["router"]

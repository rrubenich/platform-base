"""General-purpose assistant for organization members (token scope
`assistant`), and the reference agent for both execution modes.

- `agent.py`: instructions, tools and the LangGraph graph (`build`, `run`)
- `router.py`: `/v1/assistant` routes, chat over SSE and background jobs
- `jobs.py`: the functions the arq worker runs
"""

from .jobs import JOBS
from .router import router

__all__ = ["JOBS", "router"]

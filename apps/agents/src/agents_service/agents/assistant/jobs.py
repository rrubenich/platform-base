"""The assistant's background jobs, run by the arq worker (`worker.py`).

Each function's name is the job name `JobQueue.enqueue` receives; every
job also gets the `user_id` and `organization_id` of whoever queued it.
"""

from typing import Any

from ...config import get_settings
from ...llm import chat_model
from . import agent


async def run_assistant(
    ctx: dict[str, Any], *, prompt: str, user_id: str, organization_id: str
) -> dict[str, Any]:
    output = await agent.run(chat_model(get_settings().llm_model), prompt)
    return output.model_dump()


JOBS = [run_assistant]

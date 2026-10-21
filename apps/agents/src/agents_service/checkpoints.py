"""Creates or migrates the chat-thread tables in AGENTS_DATABASE_URL's
`langgraph` schema. Idempotent; run on deploy before the new version starts.

`uv run python -m agents_service.checkpoints` (wrapped as
`bun run db:checkpoints`).
"""

import asyncio
import sys

from .config import get_settings
from .platform.threads import SCHEMA, setup_checkpointer


def main() -> None:
    url = get_settings().agents_database_url
    if not url:
        sys.exit("AGENTS_DATABASE_URL is not set")
    asyncio.run(setup_checkpointer(url))
    print(f"checkpoint tables ready in schema {SCHEMA!r}")


if __name__ == "__main__":
    main()

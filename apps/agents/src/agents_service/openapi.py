"""Writes the OpenAPI schema apps/api generates its client types from.

`uv run python -m agents_service.openapi` (wrapped as `bun run openapi`).
"""

import json
from pathlib import Path

from .main import create_app

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "openapi.json"


def render() -> str:
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    SCHEMA_PATH.write_text(render())
    print(f"wrote {SCHEMA_PATH}")

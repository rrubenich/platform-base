from agents_service.openapi import SCHEMA_PATH, render


def test_committed_schema_is_current() -> None:
    # apps/api generates its client types from this file; regenerate it with
    # `bun run openapi` after changing a route or model.
    assert SCHEMA_PATH.read_text() == render()

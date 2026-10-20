from pathlib import Path

import pytest

from agents_service.agents.docs.library import DocsLibrary


@pytest.fixture
def library(tmp_path: Path) -> DocsLibrary:
    (tmp_path / "docs").mkdir()
    (tmp_path / "AGENTS.md").write_text("# Agents guide\nTokens are EdDSA JWTs.\n")
    (tmp_path / "docs" / "routes.md").write_text("# Routes\nGET /api/health\n")
    (tmp_path / "notes.txt").write_text("not a doc")
    (tmp_path / ".env").write_text("SECRET=1")
    return DocsLibrary(tmp_path)

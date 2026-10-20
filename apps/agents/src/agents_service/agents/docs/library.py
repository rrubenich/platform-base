"""The docs assistant's view of the repository: the Markdown docs it may
list, search and read, exposed to the model as tools.

Only files matching `DOC_PATTERNS` under the root are reachable, so the
model can't read `.env` files or code whatever path it asks for.
"""

from dataclasses import dataclass
from pathlib import Path

from langchain_core.tools import BaseTool, StructuredTool

# What counts as documentation, relative to the root.
DOC_PATTERNS = ("AGENTS.md", "README.md", "docs/**/*.md", "apps/*/README.md")

# Per read_doc call; longer docs are read in parts with `offset`.
MAX_READ_CHARS = 40_000
MAX_SEARCH_HITS = 40


@dataclass(frozen=True)
class DocsLibrary:
    """The Markdown docs under `root`, as the agent's tools see them."""

    root: Path

    def paths(self) -> list[str]:
        found = {
            path.relative_to(self.root).as_posix()
            for pattern in DOC_PATTERNS
            for path in self.root.glob(pattern)
            if path.is_file()
        }
        return sorted(found)

    def _resolve(self, path: str) -> Path | None:
        # Only paths from the listing: the model can't read arbitrary files.
        return self.root / path if path in self.paths() else None

    def list_docs(self) -> str:
        lines = [f"- {path}: {self._title(self.root / path)}" for path in self.paths()]
        return "\n".join(lines) or "No documents found."

    def read_doc(self, path: str, offset: int = 0) -> str:
        file = self._resolve(path)
        if file is None:
            return f"No document {path!r}. Use list_docs to see the available paths."
        text = file.read_text(encoding="utf-8")
        offset = max(offset, 0)
        part = text[offset : offset + MAX_READ_CHARS]
        end = offset + len(part)
        if end < len(text):
            part += (
                f"\n\n[Truncated: characters {offset}-{end} of {len(text)}. "
                f"Call read_doc again with offset={end} for the rest.]"
            )
        return part

    def search_docs(self, query: str) -> str:
        needle = query.strip().lower()
        if not needle:
            return "Empty query."
        hits: list[str] = []
        for path in self.paths():
            lines = (self.root / path).read_text(encoding="utf-8").splitlines()
            for number, line in enumerate(lines, start=1):
                if needle in line.lower():
                    hits.append(f"{path}:{number}: {line.strip()[:300]}")
                    if len(hits) == MAX_SEARCH_HITS:
                        return "\n".join(hits) + "\n[More matches; refine the query.]"
        return "\n".join(hits) or f"No matches for {query!r}."

    @staticmethod
    def _title(file: Path) -> str:
        for line in file.read_text(encoding="utf-8").splitlines():
            if line.startswith("#"):
                return line.lstrip("#").strip()
        return file.stem

    def tools(self) -> list[BaseTool]:
        return [
            StructuredTool.from_function(
                self.list_docs,
                name="list_docs",
                description="List every project document with its title.",
            ),
            StructuredTool.from_function(
                self.search_docs,
                name="search_docs",
                description=(
                    "Find the lines across all documents that contain `query` "
                    "(case-insensitive substring). Returns `path:line: text`. "
                    "Search for one specific term at a time."
                ),
            ),
            StructuredTool.from_function(
                self.read_doc,
                name="read_doc",
                description=(
                    "Read the document at `path` (as listed by list_docs), "
                    f"{MAX_READ_CHARS} characters at a time starting at `offset`."
                ),
            ),
        ]

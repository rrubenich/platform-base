# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""Docs assistant: explains how Platform Base is built, from the repository's docs.

For superadmins in the admin console. It has no knowledge of its own about
the app: it lists, searches and reads the Markdown docs through its tools
and answers from them, citing the files it used.
"""

from dataclasses import dataclass
from pathlib import Path

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool, StructuredTool

from .chat import Graph

# What counts as documentation, relative to the root.
DOC_PATTERNS = ("AGENTS.md", "README.md", "docs/**/*.md", "apps/*/README.md")

# Per read_doc call; longer docs are read in parts with `offset`.
MAX_READ_CHARS = 40_000
MAX_SEARCH_HITS = 40

# Kept byte-for-byte stable so it stays a cacheable prompt prefix.
INSTRUCTIONS = """\
You are the technical guide to Platform Base, for the platform's administrators. You \
explain what has been implemented and how it works: architecture, features, \
routes, data, authentication, infrastructure and conventions.

Answer only from the project's documentation, which you reach through your \
tools:
- `list_docs` lists every document with its title.
- `search_docs` finds the lines that mention a term.
- `read_doc` reads a document (long ones in parts).

Look things up before answering, even when you think you know: the docs are \
the source of truth and change over time. Read the relevant sections, not \
just search hits, before explaining something.

In your answer:
- Write in the language the user writes in.
- Be technically precise: name the files, modules, routes, settings and \
libraries the docs mention, in `code` style.
- End with the documents you used, as a "Sources" list of their paths.
- If the docs don't cover the question, say so plainly and say which document \
comes closest. Never fill gaps with guesses about the code.
- Decline questions unrelated to Platform Base in one sentence.
"""


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


def build(model: BaseChatModel, library: DocsLibrary) -> Graph:
    return create_agent(
        model, library.tools(), system_prompt=INSTRUCTIONS, name="docs_assistant"
    )

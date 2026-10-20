# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false
"""Docs assistant: explains how Platform Base is built, from the repository's docs.

For superadmins in the admin console. It has no knowledge of its own about
the app: it lists, searches and reads the Markdown docs through its tools
and answers from them, citing the files it used.
"""

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel

from ...chat import Graph
from .library import DocsLibrary

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


def build(model: BaseChatModel, library: DocsLibrary) -> Graph:
    return create_agent(
        model, library.tools(), system_prompt=INSTRUCTIONS, name="docs_assistant"
    )

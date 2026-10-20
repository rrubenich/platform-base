import pytest

from agents_service.agents.docs.library import MAX_READ_CHARS, DocsLibrary


def test_lists_only_markdown_docs_with_their_titles(library: DocsLibrary) -> None:
    assert library.list_docs() == "- AGENTS.md: Agents guide\n- docs/routes.md: Routes"


def test_searches_every_doc_case_insensitively(library: DocsLibrary) -> None:
    assert library.search_docs("eddsa") == "AGENTS.md:2: Tokens are EdDSA JWTs."
    assert (
        library.search_docs("nothing like this")
        == "No matches for 'nothing like this'."
    )


@pytest.mark.parametrize("path", [".env", "notes.txt", "../etc/passwd", "/etc/passwd"])
def test_reads_nothing_outside_the_listed_docs(library: DocsLibrary, path: str) -> None:
    assert library.read_doc(path).startswith("No document")


def test_reads_long_docs_in_parts(library: DocsLibrary) -> None:
    (library.root / "docs" / "long.md").write_text("x" * (MAX_READ_CHARS + 5))

    first = library.read_doc("docs/long.md")
    rest = library.read_doc("docs/long.md", offset=MAX_READ_CHARS)

    assert f"offset={MAX_READ_CHARS}" in first
    assert rest == "xxxxx"

# Image for the agents service and its arq worker (same image, different start
# command). Build from the repository root so the docs assistant's Markdown
# ships with it:
#   docker build -f apps/agents/Dockerfile .

# The docs assistant reads AGENTS.md, README.md, docs/**/*.md and
# apps/*/README.md (see DocsLibrary); collect exactly those under /docs.
FROM debian:bookworm-slim AS docs
WORKDIR /repo
COPY . .
RUN mkdir /docs \
	&& find AGENTS.md README.md docs apps/*/README.md -name '*.md' -type f 2>/dev/null \
		| xargs -r cp --parents -t /docs

FROM python:3.13-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
	UV_LINK_MODE=copy \
	UV_PYTHON_DOWNLOADS=never \
	PATH="/app/.venv/bin:$PATH" \
	DOCS_ROOT=/srv/platform-base

WORKDIR /app
# Dependencies first so they stay cached until the lockfile changes.
COPY apps/agents/pyproject.toml apps/agents/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps/agents/src ./src
RUN uv sync --locked --no-dev

COPY --from=docs /docs /srv/platform-base

# `::` so apps/api reaches it over Railway's private (IPv6) network.
# The worker overrides this with:
#   opentelemetry-instrument arq agents_service.worker.WorkerSettings
CMD ["sh", "-c", "exec opentelemetry-instrument fastapi run src/agents_service/main.py --host :: --port ${PORT:-8000}"]

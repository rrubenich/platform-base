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
	PATH="/srv/platform-base/apps/agents/.venv/bin:$PATH"

# Same layout as the repository, so config.py's default DOCS_ROOT (four
# levels above config.py) resolves to /srv/platform-base, where the docs land.
WORKDIR /srv/platform-base/apps/agents
# Dependencies first so they stay cached until the lockfile changes.
COPY apps/agents/pyproject.toml apps/agents/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps/agents/src ./src
RUN uv sync --locked --no-dev

COPY --from=docs /docs /srv/platform-base

# 0.0.0.0, not `::`: asyncio makes `::` IPv6-only, which fails Railway's
# healthcheck; the private network resolves to IPv4 in this project too.
# The worker overrides this with:
#   opentelemetry-instrument arq agents_service.worker.WorkerSettings
CMD ["sh", "-c", "exec opentelemetry-instrument fastapi run src/agents_service/main.py --host 0.0.0.0 --port ${PORT:-8000}"]

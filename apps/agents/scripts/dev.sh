#!/usr/bin/env bash
# Runs the HTTP server and the background-job worker together, both reloading
# on change, and stops both when either exits (or on Ctrl-C from turbo).
set -uo pipefail
cd "$(dirname "$0")/.."

run() { uv run --env-file .env opentelemetry-instrument "$@"; }

run fastapi dev src/agents_service/main.py --port "${AGENTS_PORT:-8000}" &
server=$!
OTEL_SERVICE_NAME=agents-worker run arq agents_service.worker.WorkerSettings --watch src &
worker=$!

trap 'kill "$server" "$worker" 2>/dev/null' EXIT INT TERM
# macOS ships bash 3.2, which has no `wait -n`.
while kill -0 "$server" 2>/dev/null && kill -0 "$worker" 2>/dev/null; do
	sleep 1
done

# AGENTS.md

Instructions for agents (and humans) working in this repository.

## Stack overview

- **Monorepo**: Turborepo + Bun workspaces (`bun@1.4.2`). Workspaces: `apps/*`, `packages/*`.
- **`apps/api`**: NestJS (Express adapter), Drizzle ORM over `node-postgres`, ESM (`"type": "module"`, `.js` extensions on relative imports).
- **`apps/web`**: Vite + React 19 + TanStack Router (file-based) + TanStack Query + Tailwind CSS v4.
- **`packages/ui`**: shared shadcn/ui component library (`@workspace/ui`), consumed by `apps/web`.
- **`apps/agents`**: Python 3.13 + FastAPI AI agents service on LangChain + LangGraph, provider-agnostic (the model is configuration): agents are declared once and can delegate to each other, chat threads persist in Postgres, background jobs run on Redis via arq, traces and evals go to LangSmith. Internal: only `apps/api` calls it. Managed with **uv**; its `package.json` only wraps uv so Turborepo runs it.
- **Toolchain**: [Vite+](https://viteplus.dev) (`vite-plus`, CLI `vp`): Vite for `apps/web`, Vitest for every TypeScript test suite, Oxlint for linting and Oxfmt for formatting (tabs, double quotes, sorted imports). Lint and format settings live in the root `vite.config.ts` and run once over the whole repository; `apps/agents` keeps Ruff. Run `bun run format` before committing.
- **Package manager**: Bun. Use `bun add`/`bun remove`, not `npm`/`pnpm`/`yarn`.

### External services (all cloud-hosted — no local docker needed)

| Concern | Service | Config |
|---|---|---|
| Postgres | Neon | `DATABASE_URL` in `apps/api/.env` (`neon.ts` + `neon env pull` to refresh) |
| Redis | Redis Cloud | `REDIS_URL` in `apps/api/.env` |
| Backend traces | OpenTelemetry → Grafana Cloud | `OTEL_*` in `apps/api/.env`, bootstrapped in `apps/api/src/lib/tracing.ts` |
| Frontend RUM/traces | Grafana Faro | `VITE_FARO_COLLECTOR_URL` in `apps/web/.env` |
| Frontend errors/replay | Sentry | `VITE_SENTRY_DSN` in `apps/web/.env` |
| LLM | Any LangChain provider (OpenAI by default) | `LLM_MODEL` + the provider's key (`OPENAI_API_KEY`, ...) in `apps/agents/.env` |
| Agent traces & evals | LangSmith | `LANGSMITH_*` in `apps/agents/.env` |
| Agent chat threads | Neon (`langgraph` schema) | `AGENTS_DATABASE_URL` in `apps/agents/.env` |

Every `.env.example` documents the vars for its app — copy to `.env` and fill in real values. Never commit `.env` files or paste real secrets into `.env.example`.

## Common commands

Run from the repo root (Turborepo fans these out to every workspace):

```bash
bun install        # install all workspace deps
bun run dev         # run api + web dev servers
bun run build        # build all workspaces
bun run lint          # vp lint (Oxlint) over the repo, then Ruff in apps/agents
bun run format         # vp fmt (Oxfmt) over the repo, then Ruff in apps/agents
bun run check          # vp check: format check + lint, then Ruff
bun run test           # vp test (Vitest), all workspaces
bun run typecheck       # tsc, all workspaces
```

Per-app, from `apps/api` or `apps/web`:

```bash
bun run dev           # that app's dev server only
bun run test:watch     # vp test in watch mode
```

API-specific (from `apps/api`):

```bash
bun run db:generate   # generate a Drizzle migration from schema.ts changes
bun run db:migrate    # apply migrations to the Neon database in DATABASE_URL
bun run db:studio     # open Drizzle Studio
bun run db:seed       # mock accounts for every role (src/database/seed-data.ts); --reset recreates them
bun run test:e2e      # supertest e2e suite (test/**/*.e2e-spec.ts)
```

Before considering a change done: `bun run check`, `bun run typecheck`, and `bun run test` should all pass.

Lint suppressions use Oxlint's syntax with a reason: `// oxlint-disable-next-line react/no-array-index-key -- static placeholders`. Unused ones fail the lint. Rules are tuned in the root `vite.config.ts`; prefer fixing code over turning a rule off.

## Backend features (`apps/api`)

NestJS, one feature per module folder under `apps/api/src/<feature>/`. Look at `src/health/` for the shape, and `src/database/` + `src/redis/` for how shared external resources are wired.

### 1. Scaffold the module

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts       # HTTP entry points
  <feature>.controller.spec.ts  # unit test, co-located
  <feature>.service.ts          # business logic (if there's any beyond trivial)
```

`<feature>.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { FooController } from "./foo.controller.js";

@Module({
	imports: [DatabaseModule], // only what this feature actually needs
	controllers: [FooController],
})
export class FooModule {}
```

Register it in `src/app.module.ts`'s `imports` array.

**Note the `.js` extensions on relative imports** — required because `tsconfig.json` uses `"module": "nodenext"`. TypeScript source files, `.js` import specifiers.

### 2. Controllers

Use `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`) on every controller/route — the Swagger doc is served at `/docs` (see `src/main.ts`). Follow `src/app.controller.ts` / `src/health/health.controller.ts` for the shape.

### 3. Talking to Postgres (Drizzle) or Redis

Don't instantiate a new `Pool`/`Redis` client per feature. Inject the existing shared connections:

```ts
import { Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "../database/database.module.js";

constructor(
	@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase,
) {}
```

Same pattern with `REDIS_CONNECTION` from `../redis/redis.module.js` for Redis (`ioredis` client).

### 4. Database schema changes

1. Add/edit tables in `apps/api/src/database/schema.ts` (Drizzle `pgTable`).
2. `bun run db:generate` from `apps/api` — writes a migration file under `apps/api/drizzle/`.
3. `bun run db:migrate` — applies it to the Neon database in `DATABASE_URL`.
4. Commit the generated migration file alongside the schema change.

### 5. Testing

- Unit tests: `<name>.spec.ts`, co-located, using `@nestjs/testing`'s `Test.createTestingModule`. See `src/health/health.controller.spec.ts` for mocking injected providers (`{ provide: DATABASE_CONNECTION, useValue: mockDb }`). Vitest globals are enabled (`describe`/`it`/`expect`/`vi` are available without importing them — see existing `*.spec.ts` files).
- E2E tests: `apps/api/test/*.e2e-spec.ts`, boot the real `AppModule` and hit it with `supertest`. Run via `bun run test:e2e`.

### 6. Observability

Don't add manual tracing/APM wiring per feature — `apps/api/src/lib/tracing.ts` auto-instruments HTTP, Express routes, `pg`, and `ioredis` already. It's loaded once via `NODE_OPTIONS=--import` before Nest boots (see the `dev`/`start*` scripts in `apps/api/package.json`) — don't reference it from application code.

## Frontend features (`apps/web`)

React + TanStack Router (file-based routing) + TanStack Query. Look at `src/containers/dashboard/` as the reference feature.

### 1. Container pattern

Each feature lives in `src/containers/<feature>/`:

```
containers/<feature>/
  <feature>.container.tsx   # wires provider + page together; this is what the route renders
  <feature>.page.tsx        # presentational composition of the feature's UI
  <feature>.context.tsx     # React context + hook holding the feature's data/state
  components/                # feature-local components (not shared UI)
  index.ts                   # re-exports the container: `export { FooContainer } from "./foo.container";`
```

`<feature>.context.tsx` owns data fetching (TanStack Query) and exposes it via a `use<Feature>Context()` hook that throws if called outside its provider — see `dashboard.context.tsx`. `<feature>.page.tsx` consumes that hook and stays presentational. Feature-local, non-reusable pieces go in `components/` next to the feature; anything reusable across features belongs in `packages/ui` instead (see below).

### 2. Wire it into routing

TanStack Router is file-based: add `src/routes/<path>.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { FooContainer } from "@/containers/foo";

export const Route = createFileRoute("/foo")({
	component: FooContainer,
});
```

`src/routeTree.gen.ts` is generated by the TanStack Router Vite plugin (`vite.config.ts`) — don't hand-edit it; it regenerates on dev/build.

### 3. Calling the API

Use `apiGet`/add siblings to `src/lib/api.ts` (reads `VITE_API_URL`, defaults to `/api`, proxied to the NestJS server in dev — see the `server.proxy` block in `vite.config.ts`). Fetch through TanStack Query inside the feature's context file, not ad hoc in components.

### 4. UI components

Shared, reusable components live in `packages/ui` (`@workspace/ui`), built on shadcn/ui (`components.json` at the repo root configures style/aliases). Add new shadcn components from the **`apps/web`** directory so they land in the right workspace:

```bash
bunx shadcn@latest add <component> -c apps/web
```

This places the component in `packages/ui/src/components/`. Import it in `apps/web` as:

```ts
import { Button } from "@workspace/ui/components/button";
```

The `@/` alias inside `apps/web` resolves to `apps/web/src` (see `vite.config.ts`).

### 5. Testing

Vitest + Testing Library + jsdom (`apps/web/src/test/setup.ts`). Co-locate `*.test.tsx` next to the component/container. Tests explicitly `import { describe, expect, it } from "vite-plus/test"` (Vite+'s bundled Vitest; a lint rule rejects `vitest` imports) even though `globals: true` is set — follow that existing convention (see `src/containers/dashboard/dashboard.container.test.tsx`, `packages/ui/src/components/button.test.tsx`). Use `@testing-library/user-event` for interaction, not raw `fireEvent`.

### 6. Theming

Color tokens live in `packages/ui/src/styles/globals.css` (`:root` / `.dark`), shared by every app that imports `@workspace/ui/globals.css`. Changing the palette there affects all consumers — there's a regression test (`packages/ui/src/styles/globals.test.ts`) guarding the current token values; update it alongside any intentional palette change.

## Agents service (`apps/agents`)

Python FastAPI service that runs the AI agents. **An agent is one declaration**: the platform (`src/agents_service/platform/`) turns it into a LangGraph graph, its HTTP routes, its background jobs, the tools other agents use to reach it, and its LangGraph Studio entry. Look at `agents/assistant/` as the reference agent (chat and jobs), and `agents/docs/` (the admin console's docs assistant) for one with tools. Design: `docs/superpowers/specs/2026-10-21-agents-platform-design.md`.

### How it fits

```
web ──► apps/api  /api/agents/*  ──► apps/agents  /v1/agents/{agent}/*   (internal, never exposed)
          AuthGuard + permission or      Authorization: Bearer <60s EdDSA JWT>
          active-org check, signs JWT    verified with the public key → sub, org, scope
```

- **`apps/api` is the only public entry point.** It authenticates the session, checks the user still belongs to the active organization (`AgentsService.callerFor`), then forwards the call with a JWT naming the caller: `sub` = user id, `org` = organization id (absent for platform-level agents), `scope` = the agent it is for, `iss` `platform-base-api`, `aud` `platform-base-agents`, valid for 60 seconds. `AgentsService` signs it with `AGENTS_JWT_PRIVATE_KEY` (Ed25519); `apps/agents` only has the public key (`AGENTS_JWT_PUBLIC_KEY`), so it can verify tokens but never mint one. The token is checked when a request starts; a chat stream may then outlive it.
- **Access, per request:** the token's `scope` must be the agent in the path (403), a `member` agent needs `org` in the token (403), and the agent must offer the route's mode, chat or job (404). `apps/api` decides who gets which scope: `assistant` goes to members of the active organization (`/api/agents/assistant/*`), `docs` to roles with the `docs-assistant:use` permission (admins, `/api/admin/docs-assistant/*`).
- **Network:** `apps/agents` takes no traffic from the internet, only from `apps/api` over the private network. It still needs outbound access to the LLM provider's API (and LangSmith when tracing). The JWT is a second layer on top of that isolation, not a replacement for it.
- **Rotating the key pair:** generate a new pair (see `apps/api/.env.example`) and deploy both halves together. `apps/agents` accepts a single public key, so calls fail between the two deploys; accepting several keys (by `kid`) is the follow-up if rotation must be seamless.
- **Chat** is one turn per request (`{message, thread_id?}`), streamed over SSE (`fastapi.sse.EventSourceResponse`). The first event, `thread`, names the conversation; `apps/api` pipes the stream through unchanged and aborts it when the browser disconnects.
- **Threads** are kept server-side by a LangGraph checkpointer (Postgres, Neon) under a key derived from the token: `{org or "platform"}:{user}:{agent}:{thread_id}`. A thread is private to its user, organization and agent with nothing to look up; a guessed id only reaches an empty thread of the caller's own.
- **Background jobs** run on an arq worker (`src/agents_service/worker.py`, one job function `run_agent` for every agent) over the same Redis Cloud database, on their own queue (`agents:queue`). Jobs record who queued them; a job is only visible to its organization, through its own agent.

### Layout

```
apps/agents/
  src/agents_service/
    main.py          # FastAPI app; lifespan opens the Redis pool and checkpointer, builds the Platform
    config.py        # pydantic-settings, every env var
    llm.py           # the one place the chat model is created, from LLM_MODEL
    worker.py        # arq WorkerSettings; run_agent runs any agent as a job
    checkpoints.py   # `bun run db:checkpoints`: creates the thread tables
    studio.py        # every agent for LangGraph Studio (langgraph.json)
    testing.py       # the test harness: ScriptedModel, AgentHarness (see Testing agents)
    health.py        # GET /health
    platform/        # what agents are built on; agents import from `..platform` only
      agent.py       #   Agent (the declaration), AgentContext (who a run is for), background()
      registry.py    #   Registry: checks the agents as a whole (names, delegates, audiences, loops)
      runtime.py     #   Platform: definition → graph; chat turns, thread history, one-off runs; run labels
      delegation.py  #   ask_<agent> / start_<agent> tools
      threads.py     #   thread keys, Postgres checkpointer
      routes.py      #   the one router: /v1/agents/{agent}/chat|threads|jobs
      chat.py, jobs.py, auth.py   # SSE events, arq queue, JWT → caller
    agents/
      __init__.py    # REGISTRY: every agent the service runs
      assistant/agent.py
      docs/agent.py, library.py   # anything only one agent uses lives in its package
  tests/             # pytest: platform/, agents/<name>/, the registry contract, integration/
  evals/             # real-model evals, recorded in LangSmith (`bun run eval`)
  langgraph.json     # LangGraph Studio's graph list
  openapi.json       # committed schema apps/api generates its types from
```

### Adding an agent

1. Create `agents/<name>/agent.py` with one declaration:

   ```python
   agent = Agent(
       name="scheduler",                  # token scope, route segment, tool suffix: ^[a-z][a-z0-9_]*$
       description="Finds and books ...", # what it's for: other agents see this when delegating to it
       instructions=INSTRUCTIONS,         # its system prompt (keep it byte-stable: a cacheable prefix)
       tools=[find_slots],                # @tool functions, or a function (settings) -> tools
       delegates=["calendar", background("reminders")],  # agents it may call (see below)
       audience="member",                 # "member" needs an organization; "platform" doesn't
       modes=frozenset({"chat", "job"}),  # default: chat only
   )
   ```

   Tools learn who they run for from the tool runtime, never from globals: `def find_slots(day: str, runtime: ToolRuntime[AgentContext, Any])` → `runtime.context.organization_id`. A workflow beyond the tool-calling loop passes `graph=<factory>` instead of `instructions`: the factory gets a `BuildContext` (model, tools, settings, checkpointer) and returns its own `StateGraph`, compiled with `context_schema=AgentContext` and that checkpointer.
2. Export `agent` from the package's `__init__.py`, add it to `REGISTRY` in `agents/__init__.py`, and add its entry to `langgraph.json` plus a factory in `studio.py` (a test checks they match the registry). That's all the service needs: routes, jobs and delegation tools come from the declaration.
3. Write its behavior tests in `tests/agents/<name>/` with the harness, and evals in `evals/` for what only the real model can show. The registry contract tests cover it automatically.
4. Regenerate the contract: `bun run openapi` (in `apps/agents`), then `bun run agents:types` (in `apps/api`). `tests/test_openapi.py` fails if the committed `openapi.json` is stale.
5. Expose it from `apps/api/src/agents/`: a controller that decides who may reach it and calls the generic `AgentsService` methods (`chat`, `thread`, `createJob`, `getJob`) with the agent's name; `proxyEventStream` in `event-stream.ts` pipes SSE. Add the rows to `docs/routes.md`.

Never import a provider package (`langchain_openai`, ...) or SDK in an agent: the platform gives every agent the model from `LLM_MODEL`.

### Agents calling agents

An agent lists the agents it may call in `delegates`, and its model gets a tool per delegate:

- `"calendar"` → `ask_calendar(request)`: runs that agent now, in-process, and returns its final answer as the tool result. The delegate starts a fresh, unsaved run (it can't see the conversation, so the request must carry what it needs) and runs **as the same user and organization**.
- `background("reminders")` → `start_reminders(request)`: queues it as a job for the same caller and returns the job id. The target must offer `"job"`.

The registry rejects, at import time: unknown delegates, delegating to itself, delegation loops, background targets without jobs, and **mixing audiences** (a member agent can't reach a platform agent). Declaring a delegate extends access: whoever may use the parent can, through it, use the delegate, so only delegate to agents whose data the parent's users may see. Delegation depth is capped at 3. A delegate that fails becomes the tool result `The <name> agent failed.` (details in the logs) and the parent decides what to do; the user only sees the parent's text, with each delegation shown as a `tool` event.

### Testing agents

Quality is checked in four layers; the first three run in `bun run test` with no network.

- **Platform tests** (`tests/platform/`): the definition, registry rules, delegation, threads, routes and jobs, on test-only agents (`tests/platform/agents.py`).
- **Registry contract** (`tests/test_registry_contract.py`): parametrized over `REGISTRY`, so every agent is checked for free: it binds exactly its tools and delegations, serves its modes over HTTP only for its own token, keeps its threads, and runs as a job when it says so.
- **Behavior tests** (`tests/agents/<name>/`), with `agents_service.testing`: `AgentHarness(REGISTRY, models={"assistant": ScriptedModel(call("find_slots", day="mon"), reply("Monday at 9."))})` runs the real agent (graph, tools, delegation, threads) on a scripted model. `await harness.chat(...)` returns a `Transcript` (`text`, `tool_calls`, `thread_id`, `events`), `harness.run(...)` runs it as a job, and `ScriptedModel.requests` shows what the agent sent the model (system prompt, messages, bound tools). Script exceptions to simulate provider failures. A model called more often than scripted fails the test.
- **Evals** (`evals/`, `bun run eval`): the real model, graded by code (tools used, files cited) or by an LLM judge (`evals/judge.py`), recorded with LangSmith's pytest integration (`@pytest.mark.langsmith`). With `LANGSMITH_API_KEY` set each run is an experiment in the `platform-base-agents` suite, so prompt or model changes can be compared run over run. They cost tokens and aren't part of `bun run test`; run them when changing an agent's prompt, tools or model.
- **Integration** (`tests/integration/`, marker `integration`): the Postgres checkpointer against a real database when `AGENTS_TEST_DATABASE_URL` is set (a Neon branch's direct URL; the test works in a throwaway schema); skipped otherwise.

### LangSmith and Studio

- **Tracing** is configuration only: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` (see `.env.example`). Every run is named after its agent, tagged `agent:<name>` and `entrypoint:chat|job|delegation`, with `agent`, `user_id`, `organization_id`, `delegation_depth` and `thread_id` as metadata; delegations nest under the parent's tool call. Traces carry message content: set `LANGSMITH_HIDE_INPUTS`/`LANGSMITH_HIDE_OUTPUTS` wherever it may hold sensitive or personal data. Never add tracing calls in application code.
- **Studio:** `bun run studio` (`langgraph dev`) serves every agent from `langgraph.json` to LangGraph Studio for step-by-step debugging. Set the run's context (`user_id`, `organization_id`, `agent`) in Studio the way `apps/api`'s token would.
- OpenTelemetry → Grafana Cloud stays as it is for HTTP, Redis and service traces (`opentelemetry-instrument` in the `dev`/`start*` scripts, service names `agents` and `agents-worker`); LangSmith is for what happens inside agents.

### Commands (from `apps/agents`)

```bash
uv sync               # install Python deps (bun install doesn't)
bun run dev           # FastAPI (:8000) + arq worker, both reloading
bun run lint          # ruff check + format check
bun run format        # ruff format + fixes
bun run typecheck     # pyright (strict on src/)
bun run test          # pytest (platform, contract, agents; integration when configured)
bun run eval          # real-model evals → LangSmith
bun run studio        # LangGraph Studio
bun run openapi       # rewrite openapi.json
bun run db:checkpoints  # create/migrate the thread tables in AGENTS_DATABASE_URL
```

Use `uv add <pkg>` / `uv add --dev <pkg>` for dependencies, never `pip`.

**Switching the LLM** is configuration only: set `LLM_MODEL` to another LangChain `"<provider>:<model>"` id (e.g. `anthropic:claude-opus-5-5`), add that provider's integration (`uv add langchain-anthropic`) and its API key. Only `langchain-openai` is installed by default. Provider-specific options (reasoning effort, etc.) go in `llm.chat_model`, not in agents. Errors differ per provider, so agents treat any model failure the same way (logged, reported as `model_error`).

**The docs assistant** reads Markdown from `DOCS_ROOT` (default: the repository root of this checkout): `AGENTS.md`, `README.md`, `docs/**/*.md` and `apps/*/README.md`, nothing else (`DocsLibrary` allowlist, so it can't read `.env` or code). Its answers are only as current as those docs; a deployment must ship them next to the service and set `DOCS_ROOT`.

**Data:** chat threads live in Neon, in the `langgraph` schema, through `AGENTS_DATABASE_URL` (the **direct**, unpooled connection string). Their tables belong to LangGraph's checkpointer and are created by `bun run db:checkpoints` (idempotent, run on deploy): the one exception to Drizzle owning migrations, and Drizzle never touches that schema. Without `AGENTS_DATABASE_URL` threads are kept in memory (dev only; the service logs a warning). Product tables an agent needs are still defined in `apps/api/src/database/schema.ts` and migrated with Drizzle; Python only reads and writes them.

**Deploying:** `apps/agents/Dockerfile` builds one image for both processes, from the repository root with the repository layout under `/srv/platform-base`, so the docs assistant finds its Markdown at the default `DOCS_ROOT`. On Railway it runs as two services: `agents` (the default command, private networking only, no public domain; `apps/api` reaches it at `AGENTS_URL=http://${{agents.RAILWAY_PRIVATE_DOMAIN}}:${{agents.PORT}}`) and `agents-worker` (start command `opentelemetry-instrument arq agents_service.worker.WorkerSettings`). Both need `AGENTS_DATABASE_URL` (and the `LANGSMITH_*` vars to trace); run `python -m agents_service.checkpoints` once per environment before the first deploy that uses threads.

## Routes map

[`docs/routes.md`](docs/routes.md) lists every web and API route with its access level and goal. **Keep it current**: any change that adds, removes, renames or changes the access of a route (a file under `apps/web/src/routes/`, a Nest controller method, or a Better Auth plugin that exposes new `/api/auth/*` endpoints) updates its row in the same commit. Reviewers should treat a route change without a matching `docs/routes.md` change as incomplete.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `style: ...`, `docs: ...`, `refactor(scope): ...`). Scope with the app/area touched (`db`, `api`, `web`, `cache`, `observability`, `theme`, etc.) where it adds clarity. Keep unrelated changes in separate commits.

## Things to never do

- Don't commit `.env` files or real credentials — only `.env.example` with placeholders, ever.
- Don't add a local Postgres/Redis (docker-compose or otherwise) — the project intentionally uses Neon and Redis Cloud for every environment.
- Don't bypass the shared `DATABASE_CONNECTION`/`REDIS_CONNECTION` providers with ad hoc clients.
- Don't hand-edit `apps/web/src/routeTree.gen.ts` or `apps/api/src/agents/agents-api.gen.ts`.
- Don't expose `apps/agents` publicly or call it from `apps/web`: its API is only for `apps/api`, the holder of the JWT signing key.

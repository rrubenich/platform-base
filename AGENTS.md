# AGENTS.md

Instructions for agents (and humans) working in this repository.

## Stack overview

- **Monorepo**: Turborepo + Bun workspaces (`bun@1.4.2`). Workspaces: `apps/*`, `packages/*`.
- **`apps/api`**: NestJS (Express adapter), Drizzle ORM over `node-postgres`, ESM (`"type": "module"`, `.js` extensions on relative imports).
- **`apps/web`**: Vite + React 19 + TanStack Router (file-based) + TanStack Query + Tailwind CSS v4.
- **`packages/ui`**: shared shadcn/ui component library (`@workspace/ui`), consumed by `apps/web`.
- **`apps/agents`**: Python 3.13 + FastAPI AI agents service on LangChain + LangGraph, provider-agnostic (the model is configuration), background jobs on Redis via arq. Internal: only `apps/api` calls it. Managed with **uv**; its `package.json` only wraps uv so Turborepo runs it.
- **Lint/format**: Biome (tabs, double quotes, auto-organized imports). Run `bun run format` before committing.
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

Every `.env.example` documents the vars for its app — copy to `.env` and fill in real values. Never commit `.env` files or paste real secrets into `.env.example`.

## Common commands

Run from the repo root (Turborepo fans these out to every workspace):

```bash
bun install        # install all workspace deps
bun run dev         # run api + web dev servers
bun run build        # build all workspaces
bun run lint          # biome lint, all workspaces
bun run format         # biome format --write, all workspaces
bun run test           # vitest run, all workspaces
bun run typecheck       # tsc, all workspaces
```

Per-app, from `apps/api` or `apps/web`:

```bash
bun run dev           # that app's dev server only
bun run test:watch     # vitest in watch mode
```

API-specific (from `apps/api`):

```bash
bun run db:generate   # generate a Drizzle migration from schema.ts changes
bun run db:migrate    # apply migrations to the Neon database in DATABASE_URL
bun run db:studio     # open Drizzle Studio
bun run test:e2e      # supertest e2e suite (test/**/*.e2e-spec.ts)
```

Before considering a change done: `bun run lint`, `bun run typecheck`, and `bun run test` should all pass in the affected workspace(s).

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

Vitest + Testing Library + jsdom (`apps/web/src/test/setup.ts`). Co-locate `*.test.tsx` next to the component/container. Tests explicitly `import { describe, expect, it } from "vitest"` even though `globals: true` is set — follow that existing convention (see `src/containers/dashboard/dashboard.container.test.tsx`, `packages/ui/src/components/button.test.tsx`). Use `@testing-library/user-event` for interaction, not raw `fireEvent`.

### 6. Theming

Color tokens live in `packages/ui/src/styles/globals.css` (`:root` / `.dark`), shared by every app that imports `@workspace/ui/globals.css`. Changing the palette there affects all consumers — there's a regression test (`packages/ui/src/styles/globals.test.ts`) guarding the current token values; update it alongside any intentional palette change.

## Agents service (`apps/agents`)

Python FastAPI service that runs the AI agents. Look at `src/agents_service/agents/assistant.py` as the reference agent.

### How it fits

```
web ──► apps/api  /api/agents/*  ──► apps/agents  /v1/*   (internal, never exposed)
          AuthGuard + active-org         Authorization: Bearer <60s EdDSA JWT>
          membership check, signs JWT    verified with the public key → sub (user), org
```

- **`apps/api` is the only public entry point.** It authenticates the session, checks the user still belongs to the active organization (`AgentsService.callerFor`), then forwards the call with a JWT naming the caller: `sub` = user id, `org` = organization id, `iss` `platform-base-api`, `aud` `platform-base-agents`, valid for 60 seconds. `AgentsService` signs it with `AGENTS_JWT_PRIVATE_KEY` (Ed25519); `apps/agents` only has the public key (`AGENTS_JWT_PUBLIC_KEY`), so it can verify tokens but never mint one. The token is checked when a request starts; a chat stream may then outlive it.
- **Network:** `apps/agents` takes no traffic from the internet, only from `apps/api` over the private network. It still needs outbound access to the LLM provider's API. The JWT is a second layer on top of that isolation, not a replacement for it.
- **Rotating the key pair:** generate a new pair (see `apps/api/.env.example`) and deploy both halves together. `apps/agents` accepts a single public key, so calls fail between the two deploys; accepting several keys (by `kid`) is the follow-up if rotation must be seamless.
- **Interactive agents** stream over SSE (`fastapi.sse.EventSourceResponse`); `apps/api` pipes the stream through unchanged and aborts it when the browser disconnects.
- **Background agents** run on an arq worker (`src/agents_service/worker.py`) over the same Redis Cloud database, on their own queue (`agents:queue`). Jobs record who queued them; a job is only visible to its organization.

### Layout

```
apps/agents/
  src/agents_service/
    main.py          # FastAPI app; lifespan creates the shared Redis pool
    config.py        # pydantic-settings, every env var
    llm.py           # the one place the chat model is created, from LLM_MODEL
    auth.py          # verifies apps/api's JWT → the caller (user + organization)
    dependencies.py  # shared settings, chat model and job queue
    jobs.py          # job queue (arq) with per-organization visibility
    worker.py        # arq WorkerSettings: one function per background agent
    agents/          # one module per agent: LangGraph graph (`build`) + stream/run functions
    routers/         # HTTP routes, one router per agent
  tests/             # pytest; real graphs on LangChain's fake chat model, fake queue (see conftest.py)
  openapi.json       # committed schema apps/api generates its types from
```

### Adding an agent

1. Write `agents/<name>.py` with a `build(model)` that returns a LangGraph graph: `langchain.agents.create_agent` for a tool-calling agent (tools are `@tool` functions), or your own `StateGraph` for a multi-step workflow. Take the model as a parameter and never import a provider package (`langchain_openai`, ...) or SDK in an agent: get the model from `ChatModelDep` (HTTP) or `llm.chat_model(settings.llm_model)` (worker).
2. Interactive: add `routers/<name>.py` with `dependencies=[Depends(get_caller)]` (from `auth.py`; take `CallerDep` in routes that need the user or organization) and include it in `main.py`. Background: add a `run_<name>` function to `WorkerSettings.functions` and enqueue it by that name through `JobQueueDep`.
3. Regenerate the contract: `bun run openapi` (in `apps/agents`), then `bun run agents:types` (in `apps/api`). `tests/test_openapi.py` fails if the committed `openapi.json` is stale.
4. Expose it from `apps/api/src/agents/` (controller route + `AgentsService` method) and add the rows to `docs/routes.md`.

**Switching the LLM** is configuration only: set `LLM_MODEL` to another LangChain `"<provider>:<model>"` id (e.g. `anthropic:claude-opus-5-5`), add that provider's integration (`uv add langchain-anthropic`) and its API key. Only `langchain-openai` is installed by default. Provider-specific options (reasoning effort, etc.) go in `llm.chat_model`, not in agents. Errors differ per provider, so agents treat any model failure the same way (logged, reported as `model_error`).

### Commands (from `apps/agents`)

```bash
uv sync               # install Python deps (bun install doesn't)
bun run dev           # FastAPI (:8000) + arq worker, both reloading
bun run lint          # ruff check + format check
bun run format        # ruff format + fixes
bun run typecheck     # pyright (strict on src/)
bun run test          # pytest
bun run openapi       # rewrite openapi.json
```

Use `uv add <pkg>` / `uv add --dev <pkg>` for dependencies, never `pip`. Tracing is `opentelemetry-instrument` in the `dev`/`start*` scripts with the same `OTEL_*` Grafana Cloud settings as `apps/api` (service names `agents` and `agents-worker`). Model calls themselves aren't traced yet (LangSmith or an OpenTelemetry LangChain instrumentation can add that). Don't add manual tracing in application code.

The agents service has no database access yet. When an agent needs tables, define them in `apps/api/src/database/schema.ts` and migrate with Drizzle as usual: Drizzle stays the single owner of migrations, Python only reads and writes.

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

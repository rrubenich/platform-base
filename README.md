# Platform Base

**A multi-tenant foundation for AI products.**

Platform Base is the part every AI product needs before its first feature: accounts and sign-in, organizations and teams, roles and an admin console, plus a platform for running AI agents, both as live chats and as long-running background jobs. It is domain-agnostic. Fork it, add your product's tables, screens and agents, and leave the plumbing as it is.

## What's implemented

### Accounts and authentication
- Email/password sign-up with email verification, and sign-in with Google, Apple, Microsoft or a magic link.
- Two-factor authentication: authenticator app (TOTP), emailed codes and backup codes.
- Open sign-up: a new account lands on onboarding, where it creates its organization or accepts a pending invitation.
- English and Brazilian Portuguese, end to end: UI, emails and API errors follow each user's locale.

### Organizations (multi-tenancy)
- One organization per user, with owner, admin and member roles.
- Owners and admins invite people by email, change roles, remove members, and resend or cancel invitations.
- Teams inside an organization, with team membership.
- Organization settings: rename, change the URL slug, transfer ownership, leave, delete.

### Admin console (superadmins)
- Dashboard with platform totals and a growth chart.
- User management: search, filters, roles, bans, sessions, impersonation, deletion.
- Organization management: create organizations, edit members and teams, handle invitations.
- Client invitations: create an account and its organization for a client, who sets up their login from an emailed link.
- A docs assistant: an agent that answers questions about how the codebase is built, from the repository's Markdown, with citations.

### AI agents
- **Declare an agent once.** A single declaration (name, instructions, tools, the agents it can delegate to) gives you its HTTP routes, background jobs, delegation tools and LangGraph Studio entry.
- **Chat:** one turn per request, streamed over server-sent events. Conversation threads persist in Postgres, private to each user, organization and agent.
- **Long-running agents:** any agent can also run as a background job on a Redis-backed worker, with status and results tracked per organization.
- **Agents calling agents:** an agent can call another in-process (`ask_<agent>`) or start it as a background job (`start_<agent>`). Loops, unknown delegates and audience mixing are rejected at startup.
- **Provider-agnostic:** the model is configuration (`LLM_MODEL`), so you can switch providers without touching agent code.
- **Quality:** platform and contract tests, behavior tests on a scripted model, and real-model evals recorded in LangSmith.
- **Isolation:** the agents service is internal. Only the API reaches it, with a short-lived Ed25519-signed JWT naming the user, the organization and the agent.

### Observability
- Backend traces and logs through OpenTelemetry to Grafana Cloud (HTTP, Express, Postgres, Redis), with no per-feature wiring.
- Frontend real-user monitoring with Grafana Faro, and errors and session replay with Sentry.
- Agent traces and evals in LangSmith, tagged by agent, entrypoint, user and organization.

## Architecture

```
browser ──► apps/web (Vite + React)
               │  /api (proxied, first-party cookies)
               ▼
            apps/api (NestJS) ── Better Auth · Drizzle ──► Postgres (Neon)
               │                                    └────► Redis (Redis Cloud)
               │  JWT (EdDSA, 60 s), private network only
               ▼
            apps/agents (FastAPI + LangGraph) ──► LLM provider
               └── arq worker (background agent runs) ──► Redis
```

`apps/api` is the only public entry point. It authenticates the session, checks the caller's access, and forwards agent calls to `apps/agents`, which never takes traffic from the internet.

## Apps and packages

### `apps/web`: web app
The product UI and the admin console.

| Concern | Technology |
|---|---|
| Build and dev server | Vite (through Vite+) |
| UI | React 19 |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack Query |
| Styling | Tailwind CSS v4, shadcn/ui (`@workspace/ui`) |
| Auth client | Better Auth |
| Charts, Markdown | Recharts, react-markdown + remark-gfm |
| Monitoring | Grafana Faro, Sentry |
| Tests | Vitest (through Vite+), Testing Library, jsdom |

### `apps/api`: API
Authentication, organizations, the admin API, and the gateway to the agents service. Swagger UI is served at `/docs`.

| Concern | Technology |
|---|---|
| Framework | NestJS (Express adapter), ESM |
| Auth | Better Auth (organization, admin, two-factor, magic link, OpenAPI plugins) |
| Database | Drizzle ORM over node-postgres, on Neon Postgres |
| Cache and queues | ioredis, on Redis Cloud |
| Email | Resend |
| Agent tokens | jose (Ed25519 JWT) |
| API docs | @nestjs/swagger |
| Tracing | OpenTelemetry → Grafana Cloud |
| Tests | Vitest, Supertest, PGlite (in-memory Postgres) |

### `apps/agents`: agents service
An internal Python service that runs the AI agents: chat, background jobs and delegation between agents.

| Concern | Technology |
|---|---|
| Runtime | Python 3.13, managed with uv |
| HTTP | FastAPI (SSE streaming) |
| Agents | LangChain, LangGraph |
| Threads | LangGraph Postgres checkpointer (Neon) |
| Background jobs | arq on Redis |
| Auth | PyJWT (verifies the API's Ed25519 tokens) |
| Config | pydantic-settings |
| Tracing and evals | LangSmith, OpenTelemetry |
| Tooling | Ruff, Pyright (strict), pytest, LangGraph Studio |

### `packages/ui`: design system
Shared shadcn/ui components (Base UI, Tailwind CSS v4, Hugeicons) and the color tokens every app uses.

### `packages/i18n`: translations
Messages for every app, compiled with Paraglide JS (English and Brazilian Portuguese).

### Tooling
Turborepo and Bun workspaces, TypeScript, and [Vite+](https://viteplus.dev) for the TypeScript toolchain: Vite, Vitest, Oxlint for linting and Oxfmt for formatting, configured in the root `vite.config.ts`.

## Getting started

Prerequisites: [Bun](https://bun.sh) 1.4+, Node.js 20.19+, [uv](https://docs.astral.sh/uv/), and accounts on [Neon](https://neon.tech) and [Redis Cloud](https://redis.io/cloud/). Every environment uses cloud services, so there's no local Docker setup. Emails go through [Resend](https://resend.com), and agents need an LLM provider key (OpenAI by default).

```bash
bun install                          # JavaScript workspaces
(cd apps/agents && uv sync)          # Python service

# Copy each .env.example to .env and fill it in; every variable is documented there.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/agents/.env.example apps/agents/.env

(cd apps/api && bun run db:migrate)            # app tables (Drizzle)
(cd apps/agents && bun run db:checkpoints)     # agent thread tables

bun run dev                          # web, api, agents and the worker
```

To make your first account a superadmin, put its user id in `ADMIN_USER_IDS` in `apps/api/.env`.

To try every role without inviting people by hand, seed mock accounts (all with the password `Password123!`; `--reset` recreates them):

```bash
(cd apps/api && bun run db:seed)
```

| Email | What you see |
|---|---|
| `superadmin@example.com` | Superadmin: the `/admin` console |
| `owner@example.com` | Owner of Acme Inc: the organization overview, settings, danger zone |
| `admin@example.com` | Admin of Acme Inc: the overview and settings, no transfer or delete |
| `member@example.com`, `member2@example.com` | Members of Acme Inc: the member home and the assistant, no settings |
| `globex-owner@example.com`, `globex-member@example.com` | A second organization, Globex, to check nothing leaks between tenants |
| `solo@example.com` | Signed up but in no organization: onboarding |

Acme Inc also has an Engineering and a Design team and a pending invitation for `invitee@example.com`. The seed writes to whatever `DATABASE_URL` points at, so use a development branch.

## Commands

Run from the repository root. Turborepo runs builds, type checks and tests in every workspace; lint and format run once over the repository with Vite+ (and Ruff for apps/agents).

```bash
bun run dev         # dev servers
bun run build       # build everything
bun run lint        # Oxlint (and Ruff for apps/agents)
bun run format      # Oxfmt (and Ruff for apps/agents)
bun run check       # format check + lint
bun run typecheck   # tsc (and Pyright for apps/agents)
bun run test        # every test suite
```

## Documentation

- [`AGENTS.md`](AGENTS.md): conventions and how-tos for adding API modules, web features, database changes and agents. Written for coding agents and humans alike.
- [`docs/routes.md`](docs/routes.md): every web and API route, with its access level and purpose.
- [`docs/superpowers/specs`](docs/superpowers/specs): design documents, including the [agents platform](docs/superpowers/specs/2026-10-21-agents-platform-design.md).

## License

[MIT](LICENSE)

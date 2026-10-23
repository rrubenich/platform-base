# `apps/api`

The API, and the only public entry point to the backend. It handles authentication, organizations and teams, the admin console's API, and the gateway to the internal agents service (`apps/agents`).

Built with NestJS (Express adapter, ESM), Better Auth, Drizzle ORM on Neon Postgres, ioredis on Redis Cloud, Resend for email, and OpenTelemetry for traces.

## Running it

From this directory (or `bun run dev` at the repository root to start every app):

```bash
cp .env.example .env    # every variable is documented there
bun run build           # once on a fresh checkout: dev preloads dist/lib/tracing.js
bun run db:migrate      # apply migrations to DATABASE_URL
bun run dev             # http://localhost:3000, Swagger UI at /docs
```

Every route is under `/api`. In development the web app proxies `/api` to this server, so auth cookies stay first-party.

## Layout

```
src/
  main.ts                 # bootstrap: CORS, Better Auth handler, /api prefix, Swagger at /docs
  app.module.ts           # registers every feature module
  auth/                   # AuthGuard, @RequirePermissions, @CurrentSession, the Better Auth mount
  lib/
    auth.ts               # Better Auth configuration (providers, plugins, emails)
    permissions.ts        # platform roles and the permissions they grant
    team-members.ts       # Better Auth plugin: team membership endpoints
    email.ts              # Resend wrapper
    tracing.ts            # OpenTelemetry bootstrap, preloaded via NODE_OPTIONS
  database/               # shared Drizzle connection (DATABASE_CONNECTION), schema.ts, migrate.ts
  redis/                  # shared ioredis connection (REDIS_CONNECTION)
  i18n/                   # request and user locale, translated auth errors
  health/                 # Postgres, Redis and agents service checks
  admin/                  # superadmin API: platform stats, organizations, members, teams
  account-invitations/    # superadmin client invitations and the public accept flow
  agents/                 # gateway to apps/agents: JWT signing, SSE proxy, generated client types
  testing/                # in-memory Postgres (PGlite) with migrations applied
drizzle/                  # generated SQL migrations
test/                     # e2e suites (supertest)
```

Each feature is one Nest module folder with its controller, service and co-located `*.spec.ts`. [`AGENTS.md`](../../AGENTS.md) explains how to add one.

## Authentication

[Better Auth](https://www.better-auth.com) is mounted as raw Express middleware at `/api/auth/*`, before Nest's body parser, since it needs the unparsed request body. Its own OpenAPI schema is merged into the Swagger document, so `/docs` covers the auth endpoints too.

Configured in `src/lib/auth.ts`:

- Email/password with required email verification, and Google, Apple and Microsoft sign-in.
- Magic links and two-factor authentication (TOTP, emailed codes, backup codes).
- **Organization plugin** with teams: one organization per user, owner/admin/member roles, email invitations.
- **Admin plugin** for superadmins: roles, bans, sessions, impersonation.
- The user's `locale`, which emails and API errors follow (English and Brazilian Portuguese).

### Protecting a route

`AuthGuard` resolves the session. With `@RequirePermissions`, it also checks the caller's platform role against `src/lib/permissions.ts`:

```ts
@UseGuards(AuthGuard)
@RequirePermissions({ organization: ["list"] })
@Get()
list(@CurrentSession() session: Session) { ... }
```

There are two kinds of roles:

- **Platform roles** (`user.role`): `user` or `admin`. `admin` grants the `/api/admin/*` permissions. `ADMIN_USER_IDS` grants every permission to the listed user ids, which bootstraps the first admin.
- **Organization roles** (`member.role`): `owner`, `admin` or `member`, scoped to one tenant and enforced by the organization plugin.

## Database

Drizzle ORM over `node-postgres`, on Neon. One connection is shared by every module. Inject it instead of creating a pool:

```ts
constructor(@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase) {}
```

Redis works the same way, through `REDIS_CONNECTION`.

To change the schema, edit `src/database/schema.ts`, run `bun run db:generate` to write a migration under `drizzle/`, then `bun run db:migrate`. Commit the migration with the schema change.

## Agents gateway

`src/agents/` forwards agent calls to `apps/agents`, which is only reachable over the private network. For each call, `AgentsService`:

1. checks the caller (an active organization member, or the right permission for admin agents);
2. signs a 60-second Ed25519 JWT with `AGENTS_JWT_PRIVATE_KEY` naming the user (`sub`), the organization (`org`) and the agent (`scope`);
3. forwards the request. Chat replies are server-sent events, piped through unchanged by `event-stream.ts` and aborted when the browser disconnects.

The client types in `agents-api.gen.ts` are generated from `apps/agents/openapi.json` with `bun run agents:types`. Don't edit that file by hand.

## Observability

`src/lib/tracing.ts` starts the OpenTelemetry SDK before Nest boots: `NODE_OPTIONS=--import` in the `dev` and `start*` scripts. It auto-instruments HTTP, Express, `pg` and `ioredis`, and exports traces and logs over OTLP (Grafana Cloud, configured with `OTEL_*`). Features need no tracing code of their own.

## Testing

```bash
bun run test        # unit tests (Vitest), co-located *.spec.ts
bun run test:watch
bun run test:cov
bun run test:e2e    # boots AppModule, hits it with supertest (test/*.e2e-spec.ts)
```

Tests that need real SQL use `createTestDatabase()` from `src/testing/`: an in-memory PGlite with the migrations applied, so they never touch Neon. Better Auth flows are tested end to end on it, or on Better Auth's memory adapter.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `start:dev` | Watch mode with tracing |
| `start:prod` | Run the built `dist/main` |
| `build` | `nest build` |
| `lint` / `format` | Biome |
| `typecheck` | `tsc --noEmit` |
| `db:generate` / `db:migrate` / `db:studio` | Drizzle migrations and Studio |
| `agents:types` | Regenerate the agents client types from `apps/agents/openapi.json` |

## Environment

See `.env.example` for each variable and where to get it:

| Group | Variables |
|---|---|
| Server | `PORT`, `WEB_URL` |
| Database | `DATABASE_URL` |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_USER_IDS` |
| Social sign-in | `GOOGLE_*`, `APPLE_*`, `MICROSOFT_*` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Redis | `REDIS_URL` |
| Agents | `AGENTS_URL`, `AGENTS_JWT_PRIVATE_KEY` |
| Tracing | `OTEL_*` |

Every route and the permission it needs is listed in [`docs/routes.md`](../../docs/routes.md).

# Routes

Every route in the product and what it's for. **Keep this file in sync**: add, change or remove a row in the same commit that adds, changes or removes a route (see AGENTS.md → "Routes map").

Access levels:

- **Public**: anyone.
- **Guest**: signed-out visitors only; signed-in visitors are sent to `/`.
- **User**: needs a session.
- **Superadmin**: needs Better Auth admin access (the `admin` role or an id in `ADMIN_USER_IDS`). The web checks it with `requireAdmin` (`apps/web/src/lib/auth-guards.ts`). The API checks it with `AuthGuard` + `@RequirePermissions`, so each API row names the permission it requires.

## Web (`apps/web`)

File-based routes under `apps/web/src/routes/`.

| Path | Access | Goal | Source |
|---|---|---|---|
| `/` | User | Landing that routes by role. Signed-out → `/sign-in`; superadmins → `/admin`; no organization → `/onboarding`; members see the organization dashboard: member, team and pending-invitation counts, their own teams and the five newest members; owners and admins also get "Invite people" (`/members?invite=1`) and "New team" (`/teams?new=1`) shortcuts. | `routes/_workspace/index.tsx` (layout `routes/_workspace.tsx`) → `containers/dashboard` |
| `/members` | Organization member (manage: owner/admin) | The organization's members and pending invitations. Owners and admins invite people (`?invite=1` opens the invite dialog, `?tab=invitations` shows pending invitations), change roles, remove members, and resend or cancel invitations; plain members see the lists without controls. | `routes/_workspace/members.tsx` → `containers/members` |
| `/teams` | Organization member (manage: owner/admin) | The organization's teams with their member counts. Owners and admins create (`?new=1` opens the create dialog), rename and delete teams; plain members see the list without controls. | `routes/_workspace/teams/index.tsx` → `containers/teams` |
| `/teams/$teamId` | Organization member (manage: owner/admin) | One team's members. Owners and admins add organization members to the team and remove them; plain members see the list without controls. | `routes/_workspace/teams/$teamId.tsx` → `containers/team` |
| `/settings/organization` | Organization member (edit: owner/admin; danger zone: owner) | Organization name and URL slug, and the danger zone: transfer ownership and delete the organization (owner only), leave it (any member; the only owner must transfer first). Plain members see the details read-only. | `routes/_workspace/settings/organization.tsx` → `containers/organization-settings` |
| `/onboarding` | User without an organization (members → `/`, signed-out → `/sign-in`, superadmin → `/admin`) | Create your organization (name and unique slug) or accept a pending invitation to join one; also links to `/settings/security` and signs out (→ `/sign-in`). | `routes/onboarding.tsx` → `containers/onboarding` |
| `/sign-in` | Guest | Sign in with email/password, Google, Apple or Microsoft. | `routes/(auth)/sign-in.tsx` → `containers/sign-in` |
| `/sign-up` | Guest | Create an account; sends the email verification link. | `routes/(auth)/sign-up.tsx` → `containers/sign-up` |
| `/invitations/$invitationId` | Public (accepting needs the invited email's session) | Answer an organization invitation. Signed-out visitors get Sign in / Create account (the `?email=` from the invitation link prefilled and locked, returning here); signed in as the invited email → organization, inviter and role with Accept (joins the organization and the invitation's team, then `/`) or Decline; signed in as another email → offer to sign out and continue as the invited one; invalid, expired or cancelled invitations show a message with a link home. | `routes/invitations/$invitationId.tsx` → `containers/invitation` |
| `/two-factor` | Public (mid sign-in) | Second step of sign-in when two-factor is on: TOTP, emailed code or backup code. | `routes/(auth)/two-factor.tsx` → `containers/two-factor` |
| `/settings/security` | User (redirects to `/sign-in`) | Manage the user's own two-factor authentication. | `routes/settings/security.tsx` → `containers/security` |
| `/admin` | Superadmin | Console dashboard: platform stats, growth chart, recent sign-ups. Layout route for everything under `/admin` (sidebar + breadcrumbs). | `routes/admin/route.tsx`, `routes/admin/index.tsx` → `containers/admin`, `containers/admin-dashboard` |
| `/admin/users` | Superadmin | Find and manage any account: search, filters (`?filter=admins\|banned`, `?q=`, `?page=`), roles, bans, sessions, impersonation, deletion. | `routes/admin/users/index.tsx` → `containers/admin-users` |
| `/admin/users/$userId` | Superadmin | One account's profile, ban status and active sessions. | `routes/admin/users/$userId.tsx` → `containers/admin-user` |
| `/admin/organizations` | Superadmin | Find organizations (`?q=`, `?page=`) and create one on behalf of an owner. | `routes/admin/organizations/index.tsx` → `containers/admin-organizations` |
| `/admin/organizations/$organizationId` | Superadmin | Manage one organization: details, members and roles, teams and team membership, pending invitations. | `routes/admin/organizations/$organizationId.tsx` → `containers/admin-organization` |
| `/admin/docs-assistant` | Superadmin | Chat that explains how Platform Base is built, answering from the repository's docs and citing them; shows which docs it searched and read. The conversation lives only in the page. | `routes/admin/docs-assistant.tsx` → `containers/admin-docs-assistant` |

Global, on every route (`routes/__root.tsx`): locale sync and the impersonation banner.

## API (`apps/api`)

Every route is under the `/api` prefix. The Swagger UI at `/docs` documents them all, including Better Auth's.

| Method & path | Access | Goal | Source |
|---|---|---|---|
| `GET /api` | Public | Smoke test: localized hello. | `app.controller.ts` |
| `GET /api/health/db` | Public | Postgres (Neon) connectivity check. | `health/health.controller.ts` |
| `GET /api/health/redis` | Public | Redis connectivity check. | `health/health.controller.ts` |
| `GET /api/health/agents` | Public | Agents service (`apps/agents`) liveness, via its `/health`. | `health/health.controller.ts` |
| `GET /api/admin/stats` | `user:list`, `session:list` | Platform totals for the dashboard cards. | `admin/admin.controller.ts` |
| `GET /api/admin/stats/growth?days=` | `user:list` | Daily new users/organizations, zero-filled (1–365 days, default 90). | `admin/admin.controller.ts` |
| `GET /api/admin/organizations` | `organization:list` | List/search every organization with member and team counts. | `admin/organizations/organizations.controller.ts` |
| `POST /api/admin/organizations` | `organization:create` | Create an organization owned by an existing user (gets a default team). | 〃 |
| `GET /api/admin/organizations/:id` | `organization:list` | Organization detail: members, teams with their users, pending invitations. | 〃 |
| `PATCH /api/admin/organizations/:id` | `organization:update` | Rename or change the slug. | 〃 |
| `DELETE /api/admin/organizations/:id` | `organization:delete` | Delete it with its members, teams and invitations (user accounts stay). | 〃 |
| `POST /api/admin/organizations/:id/members` | `organization-member:create` | Add an existing user directly, without an invitation. | 〃 |
| `PATCH /api/admin/organizations/:id/members/:memberId` | `organization-member:update` | Change a member's role (the last owner can't be demoted). | 〃 |
| `DELETE /api/admin/organizations/:id/members/:memberId` | `organization-member:delete` | Remove a member and their team memberships (the last owner can't be removed). | 〃 |
| `POST /api/admin/organizations/:id/teams` | `team:create` | Create a team. | 〃 |
| `PATCH /api/admin/organizations/:id/teams/:teamId` | `team:update` | Rename a team. | 〃 |
| `DELETE /api/admin/organizations/:id/teams/:teamId` | `team:delete` | Delete a team (members stay in the organization). | 〃 |
| `POST /api/admin/organizations/:id/teams/:teamId/members` | `team:update` | Add an organization member to a team. | 〃 |
| `DELETE /api/admin/organizations/:id/teams/:teamId/members/:userId` | `team:update` | Remove a user from a team. | 〃 |
| `POST /api/agents/assistant/chat` | Organization member (active organization) | One chat turn with the assistant agent (`{message, threadId?}`); the reply streams back as server-sent events (`thread` first, then `tool`/`delta`, then `done` or `error`). Proxied to `apps/agents`. | `agents/agents.controller.ts` |
| `GET /api/agents/assistant/threads/:id` | Organization member (active organization) | The caller's own conversation with the assistant; 404 for anyone else's. | 〃 |
| `POST /api/agents/assistant/jobs` | Organization member (active organization) | Queue a background assistant run; returns its id (202). | 〃 |
| `GET /api/agents/assistant/jobs/:id` | Organization member (active organization) | A background job's status and result; 404 for jobs of other organizations. | 〃 |
| `POST /api/admin/docs-assistant/chat` | `docs-assistant:use` | One chat turn with the docs assistant agent (`{message, threadId?}`); the reply streams back as server-sent events (`thread`, `tool`, `delta`, then `done` or `error`). Proxied to `apps/agents`. | `agents/docs-assistant.controller.ts` |
| `GET /api/admin/docs-assistant/threads/:id` | `docs-assistant:use` | The admin's own conversation with the docs assistant. | 〃 |

### Agents service (`apps/agents`, internal)

Not reachable from the browser: only `apps/api` calls these, with a 60-second EdDSA JWT (`Authorization: Bearer`) whose `sub` and `org` claims name the user and organization (when there is one), and whose `scope` names the agent it may reach (403 on any other). Its own Swagger UI is at `:8000/docs`.

| Method & path | Access | Goal | Source |
|---|---|---|---|
| `GET /health` | Public (internal network) | Liveness probe. | `health.py` |
| `POST /v1/agents/{agent}/chat` | JWT, scope `{agent}`; with `org` for member agents | One chat turn (`{message, thread_id?}`) in the caller's thread, streamed as SSE: `thread`, then `tool`/`delta`, then `done` or `error`. 404 for agents without chat. | `platform/routes.py` |
| `GET /v1/agents/{agent}/threads/{thread_id}` | JWT, scope `{agent}` | The caller's conversation (user and agent text only); 404 when it's empty or someone else's. | 〃 |
| `POST /v1/agents/{agent}/jobs` | JWT, scope `{agent}`, with `org` | Queue a run on the arq worker; 404 for agents without jobs. | 〃 |
| `GET /v1/agents/{agent}/jobs/{job_id}` | JWT, scope `{agent}` (same organization) | Job status and result; 404 for other organizations' or other agents' jobs. | 〃 |

`{agent}` is one of the registered agents (`agents/__init__.py`): `assistant` (member, chat and jobs) and `docs` (platform, chat).

### Better Auth (`/api/auth/*`)

Served by Better Auth itself (`auth/mount-auth-handler.ts`, configured in `lib/auth.ts`), not by Nest controllers. Its own endpoints are listed under `/docs`. The groups the product relies on:

| Group | Goal |
|---|---|
| `sign-up/*`, `sign-in/*`, `sign-out`, `get-session` | Email/password and social (Google, Apple, Microsoft) authentication and the session. |
| `verify-email`, `request-password-reset`, `reset-password` | Links sent by email (via Resend). |
| `callback/:provider` | OAuth callbacks from the social providers. |
| `two-factor/*` | TOTP, emailed OTP and backup codes. |
| `admin/*` | Admin plugin: list/ban/impersonate users, set roles, revoke sessions, `has-permission`. |
| `organization/*` | Organization plugin as used by members inside their own organizations (the superadmin equivalents are the `/api/admin/organizations` routes above). |
| `GET organization/team-members?teamId=` | Organization member. Our own endpoint (`lib/team-members.ts`): a team's members for any member of the team's organization — the plugin's `organization/list-team-members` only answers people in that team, so owners and admins outside it couldn't see it. |

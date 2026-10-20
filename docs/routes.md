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
| `/` | User | Landing that routes by role. Signed-out → `/sign-in`; superadmins → `/admin`; no organization → `/onboarding`; members see a temporary welcome page (placeholder until the dashboard exists). | `routes/_workspace/index.tsx` (layout `routes/_workspace.tsx`) → `containers/home` |
| `/members` | Organization member (manage: owner/admin) | The organization's members and pending invitations. Owners and admins invite people (`?invite=1` opens the invite dialog, `?tab=invitations` shows pending invitations), change roles, remove members, and resend or cancel invitations; plain members see the lists without controls. | `routes/_workspace/members.tsx` → `containers/members` |
| `/onboarding` | User without an organization (members → `/`, signed-out → `/sign-in`, superadmin → `/admin`) | Create your organization (name and unique slug) or accept a pending invitation to join one. | `routes/onboarding.tsx` → `containers/onboarding` |
| `/sign-in` | Guest | Sign in with email/password, Google, Apple or Microsoft. | `routes/(auth)/sign-in.tsx` → `containers/sign-in` |
| `/sign-up` | Guest | Create an account; sends the email verification link. | `routes/(auth)/sign-up.tsx` → `containers/sign-up` |
| `/two-factor` | Public (mid sign-in) | Second step of sign-in when two-factor is on: TOTP, emailed code or backup code. | `routes/(auth)/two-factor.tsx` → `containers/two-factor` |
| `/settings/security` | User (redirects to `/sign-in`) | Manage the user's own two-factor authentication. | `routes/settings/security.tsx` → `containers/security` |
| `/admin` | Superadmin | Console dashboard: platform stats, growth chart, recent sign-ups. Layout route for everything under `/admin` (sidebar + breadcrumbs). | `routes/admin/route.tsx`, `routes/admin/index.tsx` → `containers/admin`, `containers/admin-dashboard` |
| `/admin/users` | Superadmin | Find and manage any account: search, filters (`?filter=admins\|banned`, `?q=`, `?page=`), roles, bans, sessions, impersonation, deletion. | `routes/admin/users/index.tsx` → `containers/admin-users` |
| `/admin/users/$userId` | Superadmin | One account's profile, ban status and active sessions. | `routes/admin/users/$userId.tsx` → `containers/admin-user` |
| `/admin/organizations` | Superadmin | Find organizations (`?q=`, `?page=`) and create one on behalf of an owner. | `routes/admin/organizations/index.tsx` → `containers/admin-organizations` |
| `/admin/organizations/$organizationId` | Superadmin | Manage one organization: details, members and roles, teams and team membership, pending invitations. | `routes/admin/organizations/$organizationId.tsx` → `containers/admin-organization` |

Global, on every route (`routes/__root.tsx`): locale sync and the impersonation banner.

## API (`apps/api`)

Every route is under the `/api` prefix. The Swagger UI at `/docs` documents them all, including Better Auth's.

| Method & path | Access | Goal | Source |
|---|---|---|---|
| `GET /api` | Public | Smoke test: localized hello. | `app.controller.ts` |
| `GET /api/health/db` | Public | Postgres (Neon) connectivity check. | `health/health.controller.ts` |
| `GET /api/health/redis` | Public | Redis connectivity check. | `health/health.controller.ts` |
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

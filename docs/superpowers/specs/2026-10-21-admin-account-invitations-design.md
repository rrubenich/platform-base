# Admin account invitations — design

Date: 2026-10-21 · Status: approved in conversation (approach, backend, web and tests) · Branch: `feat/admin-account-invitations`

## Goal

Accounts are created by a superadmin, not by self-service sign-up. From the admin console a superadmin enters a person's email and a new organization's name; the person gets an account (without a password yet) as the owner of that organization, and an email with a link where they set their name and password. Until then — and after — the superadmin can impersonate that owner to set up teams, members and settings in the organization's own workspace.

## Decisions

| Topic | Decision |
|---|---|
| Who creates accounts | Superadmins (account invitations) and, for brand-new people joining an existing organization, that organization's owners/admins through the organization plugin's existing invitations. Nobody else. |
| Organization | Every account invitation creates a new organization with the invited person as `owner` (plus the plugin's default team). No invitation without an organization, no adding to an existing one. |
| Completing the account | Name + password on `/welcome/$token`. The link proves the email, so it's marked verified. Social / magic-link sign-in work afterwards for that email (existing account linking). |
| Mechanism | Our own `account_invitation` table and Nest module. Not Better Auth's reset-password (its token lifetime is global, 1 h by default, and it doesn't verify the email) and not an organization-plugin invitation (needs an owner who doesn't exist yet). |
| Link lifetime | 7 days (same as organization invitations); resend rotates the token and renews the expiry. |
| Closing sign-up | One `databaseHooks.user.create.before` gate for every way a user can be created (email, Google, Apple, Microsoft, magic link). |
| Impersonation | Nothing new in Better Auth: the owner exists from the start, so the existing admin impersonation applies. The UI adds an entry point next to the owner. |

## 1. Data

New table in `apps/api/src/database/schema.ts`, migrated with `bun run db:generate` + `db:migrate`:

```ts
export const accountInvitation = pgTable("account_invitation", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	invitedById: text("invited_by_id").references(() => user.id, { onDelete: "set null" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	acceptedAt: timestamp("accepted_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("account_invitation_user_id_idx").on(t.userId), index("account_invitation_organization_id_idx").on(t.organizationId)]);
```

- The token is 32 random bytes, base64url, sent only in the email. Only its SHA-256 is stored, so a database leak doesn't hand out usable links.
- Status is derived, not stored: `accepted` (`acceptedAt` set), `expired` (`expiresAt` past), else `pending`.
- One invitation per user. Resend updates the row in place.

## 2. API (`apps/api/src/account-invitations/`)

`AccountInvitationsModule` imports `DatabaseModule` and the auth instance (`AUTH_INSTANCE`), like `admin/organizations`.

### Service

- **`create({ email, organizationName, slug }, invitedBy, locale)`**
  1. Normalizes the email (trim, lowercase). 409 `EMAIL_TAKEN` if a user with it exists; 409 `SLUG_TAKEN` if the slug is in use.
  2. `auth.api.createUser({ body: { email, name: email, role: "user" } })` — no password, no credential account. The name is a placeholder replaced on acceptance.
  3. `auth.api.createOrganization({ body: { name, slug, userId } })` — adds the owner membership and the default team, as `OrganizationsService.create` already does.
  4. Inserts the invitation and sends the email.
  If step 3, 4 or the email fails, the user is deleted (cascading to anything created) and the error is rethrown, so a failed invite leaves nothing behind. Returns `{ id, organizationId, userId }`.
- **`resend(id, locale)`**: 404 if missing, 409 `ALREADY_ACCEPTED` if accepted. New token, `expiresAt = now + 7 d`, email again.
- **`cancel(id)`**: 409 `ALREADY_ACCEPTED` if accepted; otherwise deletes the user — the cascade removes the organization's membership and the invitation — and deletes the organization (with its teams), as `OrganizationsService.remove` does.
- **`preview(token)`**: `{ email, organizationName }`; 404 for an unknown token, 410 `INVITATION_EXPIRED` / `INVITATION_ACCEPTED`.
- **`accept(token, { name, password })`**: same checks as `preview`. Enforces the password policy (8–128, as `emailAndPassword`). In one transaction: inserts the `credential` account with `password = await (await auth.$context).password.hash(password)`, updates the user (`name`, `emailVerified = true`), sets `acceptedAt` — the update on `account_invitation` is conditional on `acceptedAt IS NULL`, so two concurrent accepts can't both succeed. Doesn't create a session: the web signs in with the new password right after.
- **`ownerSetupFor(organizationId)`**: the invitation summary (`{ id, email, expiresAt, status }`) or `null`, for the organization detail.

### Routes

| Method & path | Access | Goal |
|---|---|---|
| `POST /api/admin/account-invitations` | `user:create`, `organization:create` | Create user + organization + invitation, send the link. Body `{ email, organizationName, slug }`. |
| `POST /api/admin/account-invitations/:id/resend` | `user:create` | New link, new 7-day expiry. |
| `GET /api/admin/account-invitations?userIds=` | `user:list` | Pending/expired account invitations for the given users (at most 100 ids), for the `/admin/users` badge. |
| `DELETE /api/admin/account-invitations/:id` | `user:delete`, `organization:delete` | Cancel a pending invitation: deletes the pending user and the organization. |
| `GET /api/account-invitations/:token` | Public (the token is the credential) | Preview for `/welcome`. |
| `POST /api/account-invitations/:token/accept` | Public (the token is the credential) | Set name + password, verify the email. |

`GET /api/admin/organizations/:id` gains `ownerSetup: { id, email, expiresAt, status } | null`. `/admin/users` lists users through Better Auth's `admin/list-users`, which knows nothing about invitations, so its "Pending setup" badge comes from the lookup route above for the visible page.

No rate limiting on the public routes: the API has no limiter today and a 256-bit random token can't be enumerated. Swagger decorators on every route; DTOs with `class-validator` like `organizations.dto.ts` (slug pattern reused from there).

### Email

New messages in `@workspace/i18n` (every locale): `email_account_invitation_subject` ("{organization} on Platform Base"), `_body` ("{inviter} invited you to manage {organization} on Platform Base."), `_link` ("Set up your account"), `_expiry` (days). Locale: the superadmin's request locale (`requestLocale`), as organization invitations do when the invitee has no account. URL: `${WEB_URL}/welcome/${token}`. HTML-escaped like `sendInvitationEmail`. `sendEmail` moves from `lib/auth.ts` to `lib/email.ts` so both use it.

## 3. Closing sign-up (`apps/api/src/lib/auth.ts`)

- **`databaseHooks.user.create.before(user, ctx)`**: allowed when `ctx?.path === "/admin/create-user"` (only reachable with `user:create`) or when a `pending` organization `invitation` (status `pending`, `expiresAt` in the future) exists for `user.email`. Otherwise throws `APIError("FORBIDDEN", { code: "SIGN_UP_DISABLED" })` with a translated message (new `auth_error_SIGN_UP_DISABLED`). One gate covers `/sign-up/email`, social callbacks and magic link. Existing users signing in are unaffected (no user is created).
- **`organization({ allowUserToCreateOrganization: false })`**: members can't create organizations. The admin paths keep working: `auth.api.createOrganization({ body: { userId, … } })` called server-side without a session is a "system action" the plugin exempts from this option (`routes/crud-org.mjs` in better-auth 1.7.10); a test pins that.
- `organizationLimit: 1`, the accept-invitation guard and everything else stay.

## 4. Web (`apps/web`)

### Admin console

- **`/admin/organizations`** (`containers/admin-organizations`): an **Invite client** button opens `components/invite-client-dialog.tsx` — email, organization name, slug (suggested from the name, editable, same helper as onboarding). Submits `POST /api/admin/account-invitations`; on success, toast and navigate to `/admin/organizations/$organizationId`. 409s map to field errors. "Create organization" (existing owner) stays.
- **`/admin/organizations/$organizationId`** (`containers/admin-organization`):
  - `components/owner-setup-card.tsx`, shown when `ownerSetup` is `pending` or `expired`: email, expiry, badge, **Resend link**, **Cancel invitation** (confirm dialog: "deletes the account and the organization").
  - Members card: an **Impersonate** action on each member row, reusing `use-admin-user-actions` (same as `/admin/users`); impersonating lands on `/`, where `requireOrganization` activates their organization.
- **`/admin/users`**: a "Pending setup" badge on users with a pending account invitation.
- Calls go through `src/lib/admin-api.ts` siblings and TanStack Query in each container's context.

### `/welcome/$token` (new, public) → `containers/welcome`

- Loads the preview. Valid → "You've been invited to manage **{organization}**", email shown read-only, name, password and confirmation (rules from `lib/password-policy.ts`). Submit → `accept` → `authClient.signIn.email({ email, password })` → `/` (the workspace; onboarding for 2FA etc. is unchanged). If sign-in returns the two-factor redirect it can't (2FA isn't on yet), so no special case.
- 410 expired → "This link expired; ask whoever invited you for a new one." 410 accepted → "Your account is already set up" + link to `/sign-in`. 404 → invalid link.
- Signed in already → "You're signed in as {email}" with sign out and continue.

### Closed sign-up

- `/sign-in`: remove the "Create account" link.
- `/sign-up`: stays for organization invitees (the invitation page links to it with `?email=`). Without `?email=` it shows "Platform Base is invite-only" with a link to sign in. The API error `SIGN_UP_DISABLED` is shown if someone submits without an invitation.
- `/onboarding`: remove the create-organization form; show pending invitations to accept, else "You're not in an organization yet — ask your organization's admin to invite you", plus security settings and sign out. Social sign-ins with no invitation never get this far (the gate rejects them; the sign-in page shows the error).

## 5. Docs

`docs/routes.md`, in the same commits as the routes: new rows for `/welcome/$token` and the six API routes; changed rows for `/sign-in`, `/sign-up`, `/onboarding`, `/admin/organizations`, `/admin/organizations/$organizationId`, `/admin/users`, `GET /api/admin/organizations/:id`.

## 6. Testing

- **API unit** (`*.spec.ts`, mocks like `organizations.service.spec.ts`):
  - service: create (happy path, 409s, rollback when the organization or the email fails), resend (rotates the hash, renews the expiry, 409 when accepted), cancel (409 when accepted; deletes user + organization), preview/accept (404, 410 expired/accepted, password policy, email verified, single use under concurrency via the conditional update).
  - controllers: permissions on the admin routes, public routes don't need a session.
  - `auth.spec.ts`: the creation gate rejects a plain sign-up and a social/magic-link creation without invitation, allows `/admin/create-user` and an email with a pending organization invitation, rejects an expired one; members can't create organizations; the admin creation path still can.
- **API e2e** (`test/account-invitations.e2e-spec.ts`): the routes are wired (401 without a session on the admin routes, 404 for an unknown token). The full flow (create → token from the mocked email → preview → accept → sign in → owner of an organization with its default team) runs in the service spec against PGlite, since e2e boots against the real `DATABASE_URL`.
- **Web** (Vitest + Testing Library, `user-event`): invite dialog (submit, slug suggestion, 409 field errors), owner-setup card (badge, resend, cancel confirm), members-card impersonate, `/welcome` (valid → accept → sign in → navigate; expired; accepted; signed in), onboarding without the create form, sign-in without "Create account", sign-up without `?email=`.

## Out of scope

- Inviting someone without an organization, or into an existing one, from the console.
- Closing sign-up per environment (feature flag): it's closed everywhere.
- Rate limiting public API routes.
- Seamless handling of 2FA during `/welcome` (accounts start without it).

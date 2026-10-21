# Admin Account Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmins create accounts by email (plus a new organization the person owns); the person finishes setup with name + password through an emailed link; self-service sign-up and organization creation close.

**Architecture:** A new Nest module `apps/api/src/account-invitations/` owns an `account_invitation` table, creates the user and organization through Better Auth's server API, and accepts the invitation by writing the credential account itself. A `databaseHooks.user.create.before` gate in `lib/auth.ts` closes sign-up for every provider. The web gets an invite dialog and owner-setup card in the admin console, a public `/welcome/$token` page, and loses self-service sign-up and organization creation.

**Tech Stack:** NestJS + Drizzle (PGlite in tests), Better Auth 1.7.10 (admin + organization plugins), Vite + React 19 + TanStack Router/Query, Paraglide i18n (`packages/i18n/messages/{en,pt-BR}.json`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-admin-account-invitations-design.md`

## Global Constraints

- Link lifetime: 7 days (`INVITATION_EXPIRY_DAYS`); resend rotates the token and renews the expiry.
- Token: 32 random bytes, base64url, only in the email; only its SHA-256 (hex) is stored.
- Password policy: 8–128 characters (same as `emailAndPassword`).
- Invitation URL: `${WEB_URL ?? "http://localhost:5173"}/welcome/${token}`.
- Error codes: `EMAIL_TAKEN`, `SLUG_TAKEN` (409), `ALREADY_ACCEPTED` (409), `INVITATION_EXPIRED`, `INVITATION_ACCEPTED` (410), Better Auth gate `SIGN_UP_DISABLED` (403).
- Every new string exists in both `en.json` and `pt-BR.json`.
- Relative imports in `apps/api` end in `.js`. Biome formatting (tabs, double quotes). Web tests import from `vitest` explicitly and use `user-event`.
- `docs/routes.md` changes in the same commit as the route it describes.
- Commits: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit on `main`.

## Review Focus

1. **Email case:** a superadmin types `Jane@Example.com`; the user, the uniqueness check and the gate's invitation lookup all use the lowercased email → test in Task 3 (`create` with mixed case is rejected as `EMAIL_TAKEN` against `jane@example.com`) and Task 2 (gate finds an invitation stored lowercase).
2. **Double submit on `/welcome`:** two concurrent accepts of the same token; exactly one succeeds, the other gets 410 `INVITATION_ACCEPTED`, and only one credential account exists → test in Task 3.
3. **Resend invalidates the old link:** after resend, the previous token is 404 → test in Task 3.
4. **Owner deletes their own org or is removed after accepting:** `cancel` on an accepted invitation is refused (409) instead of deleting a real account → test in Task 3.
5. **Signed-in visitor opens `/welcome`:** they're told who they're signed in as and offered sign-out instead of setting a password for someone else → test in Task 6.

---

### Task 1: `account_invitation` table

**Files:**
- Modify: `apps/api/src/database/schema.ts` (append table + relations if the file defines relations for neighbors)
- Create: `apps/api/drizzle/0004_*.sql` + `drizzle/meta/*` (generated)

**Interfaces:**
- Produces: `schema.accountInvitation` with columns `id, email, userId, organizationId, invitedById, tokenHash (unique), expiresAt, acceptedAt, createdAt`; FKs: `userId → user.id` cascade, `organizationId → organization.id` cascade, `invitedById → user.id` set null; indexes on `userId` and `organizationId`. Exact definition in spec §1.

- [ ] **Step 1:** Add the table to `schema.ts` as in spec §1.
- [ ] **Step 2:** Run `bun run db:generate` in `apps/api`. Expected: a new `drizzle/0004_<name>.sql` with `CREATE TABLE "account_invitation"`. Rename it `0004_account_invitations.sql` and update its `tag` in `drizzle/meta/_journal.json` (as `0001_user_locale` was).
- [ ] **Step 3:** Run `bun run test` in `apps/api` — PGlite applies all migrations in every DB-backed spec. Expected: PASS (nothing uses the table yet).
- [ ] **Step 4:** Commit `feat(db): account_invitation table`. (`db:migrate` against Neon is run by the user/deploy, not here.)

### Task 2: Close sign-up and organization creation

**Files:**
- Create: `apps/api/src/lib/sign-up-gate.ts`, `apps/api/src/lib/sign-up-gate.spec.ts`
- Modify: `apps/api/src/lib/auth.ts` (`databaseHooks`, `allowUserToCreateOrganization: false`)
- Modify: `packages/i18n/messages/en.json`, `pt-BR.json` (`auth_error_SIGN_UP_DISABLED`)
- Modify (keep green): `apps/api/src/lib/organization.spec.ts`, `admin.spec.ts`, `two-factor.spec.ts`, `apps/api/src/auth/mount-auth-handler.spec.ts`, `apps/api/src/admin/organizations/organizations.service.spec.ts`

**Interfaces:**
- Produces: `export const signUpGate: NonNullable<BetterAuthOptions["databaseHooks"]>` — `user.create.before(user, ctx)`; `authOptions.databaseHooks === signUpGate`.
- Allowed when `ctx?.path === "/admin/create-user"`, or `ctx.context.adapter.findMany({ model: "invitation", where: [{ field: "email", value: user.email.toLowerCase() }, { field: "status", value: "pending" }] })` has one with `expiresAt > now`. Otherwise `throw new APIError("FORBIDDEN", { code: "SIGN_UP_DISABLED", message: m.auth_error_SIGN_UP_DISABLED({}, { locale: requestLocale(ctx?.headers) }), originalMessage: "Sign-up is by invitation only" })` (thrown before the i18n after-hook can translate it, like the accept-invitation guard). `ctx` null (internal calls with no endpoint) → refused too.

- [ ] **Step 1: Failing tests** in `sign-up-gate.spec.ts`, using the HTTP client pattern of `organization.spec.ts` (memory adapter, mocked Resend, `betterAuth({ ...authOptions, database: memoryAdapter(db), secret })`):
  - `refuses email sign-up without an invitation` → `POST /sign-up/email` status 403, body `code === "SIGN_UP_DISABLED"`, `db.user` empty.
  - `refuses it in the request's locale` → `accept-language: pt-BR`, message equals `m.auth_error_SIGN_UP_DISABLED({}, { locale: "pt-BR" })`.
  - `refuses a magic-link sign-up without an invitation` → `POST /sign-in/magic-link` then `GET /magic-link/verify?token=…` (token from the captured email) creates no user.
  - `allows sign-up for an email with a pending organization invitation` → seed `db.invitation` row `{ email: "jane@example.com", status: "pending", expiresAt: +1 d, … }`, sign up `Jane@Example.com` → 200.
  - `refuses it when that invitation expired` → `expiresAt: -1 s` → 403.
  - `allows an admin to create a user` → `testAuth.api.createUser({ body: { email, name } })` (server-side, no headers) returns the user.
  - `members can't create an organization` → sign-in as a seeded verified user with a credential account, `POST /organization/create` → 403 `YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION`.
  - `the server can still create one for a user` → `testAuth.api.createOrganization({ body: { name, slug, userId } })` returns the org.
- [ ] **Step 2:** `bun run test src/lib/sign-up-gate.spec.ts` in `apps/api`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `signUpGate`; wire it and `allowUserToCreateOrganization: false` into `authOptions`; add the message (`en`: "Sign-up is by invitation only.", `pt-BR`: "O cadastro é feito apenas por convite.").
- [ ] **Step 4:** Run the new spec. Expected: PASS.
- [ ] **Step 5:** Run all of `apps/api`'s tests. Specs that sign users up to test something else build their instance with `databaseHooks: {}` spread after `authOptions` and a one-line comment ("open sign-up: these tests are about X, the gate has its own spec"). In `organization.spec.ts`, organizations are created with `testAuth.api.createOrganization({ body: { …, userId } })` instead of `POST /organization/create`, and the "blocks creating a second organization" test calls the server API for the second one (still expects `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS`). Expected: all PASS.
- [ ] **Step 6:** Update `docs/routes.md` Better Auth table: `sign-up/*` row says sign-up only succeeds for emails with a pending organization invitation (or accounts created by a superadmin), and the `organization/*` row says members can't create organizations. Commit `feat(auth): sign-up by invitation only`.

### Task 3: `AccountInvitationsService`

**Files:**
- Create: `apps/api/src/lib/email.ts` (move `sendEmail` + `escapeHtml` + `emailFrom`/`getResend` out of `auth.ts`; `auth.ts` imports them)
- Create: `apps/api/src/account-invitations/account-invitations.service.ts`, `account-invitations.service.spec.ts`, `account-invitations.dto.ts`
- Modify: `packages/i18n/messages/en.json`, `pt-BR.json` (`email_account_invitation_subject|body|link|expiry`)

**Interfaces:**
- Consumes: `schema.accountInvitation` (Task 1); gate allows `/admin/create-user` (Task 2).
- Produces:
  - `type AccountInvitationsAuthApi = { api: { createUser(input: { body: { email: string; name: string; role: "user" } }): Promise<{ user: { id: string } }>; createOrganization(input: { body: { name: string; slug: string; userId: string } }): Promise<{ id: string } | null> }; $context: Promise<{ password: { hash(p: string): Promise<string> } }> }`
  - `type InvitationStatus = "pending" | "expired" | "accepted"`
  - `type OwnerSetup = { id: string; email: string; expiresAt: Date; status: InvitationStatus }`
  - `class AccountInvitationsService` (injects `DATABASE_CONNECTION`, `AUTH_INSTANCE`):
    - `create(input: { email: string; organizationName: string; slug: string }, invitedBy: { id: string; name: string }, locale: Locale): Promise<{ id: string; organizationId: string; userId: string }>`
    - `resend(id: string, inviterName: string, locale: Locale): Promise<OwnerSetup>`
    - `cancel(id: string): Promise<void>`
    - `preview(token: string): Promise<{ email: string; organizationName: string }>`
    - `accept(token: string, input: { name: string; password: string }): Promise<{ email: string }>`
    - `forOrganization(organizationId: string): Promise<OwnerSetup | null>` (latest; `null` once accepted, so the card disappears)
    - `forUsers(userIds: string[]): Promise<(OwnerSetup & { userId: string })[]>` (not accepted only)
  - DTOs (`class-validator`, like `organizations.dto.ts`): `CreateAccountInvitationBody { email (IsEmail, ≤254), organizationName (≤100), slug (SLUG_PATTERN — export it from organizations.dto.ts) }`, `AcceptAccountInvitationBody { name (1–100), password (8–128) }`, `AccountInvitationsQuery { userIds: string[] (comma-separated in the query, 1–100) }`.
- Email copy (`en` / `pt-BR`):
  - subject: "Set up your {organization} account on Platform Base" / "Configure sua conta da {organization} no Platform Base"
  - body: "{inviter} invited you to manage {organization} on Platform Base." / "{inviter} convidou você para gerenciar a {organization} no Platform Base."
  - link: "Set up your account" / "Configurar minha conta"
  - expiry: reuse `email_invitation_expiry`.

- [ ] **Step 1: Failing tests** in `account-invitations.service.spec.ts` against PGlite + the production auth config, set up like `organizations.service.spec.ts` (Resend mocked to capture `sent`; token read from the captured link with `/welcome\/([\w-]+)/`):
  - `create`: user exists with `emailVerified: false`, no account rows, `role: "user"`; organization has that user as `owner` and one team; invitation `expiresAt ≈ now + 7 d`; one email to the lowercased address whose html contains the org name and `http://localhost:5173/welcome/`; stored `tokenHash` ≠ the token in the link.
  - `create` rejects an existing email (`Jane@Example.com` vs existing `jane@example.com`) with `ConflictException` code `EMAIL_TAKEN`, and a taken slug with `SLUG_TAKEN`; neither leaves a new user behind.
  - `create` rolls back when the email fails: Resend mock returns `{ error }` once → throws, and no user/organization/invitation for that email remain.
  - `preview`: returns `{ email, organizationName }`; unknown token → `NotFoundException`; expired (update `expiresAt` to past) → `GoneException` `INVITATION_EXPIRED`.
  - `accept`: then `testAuth.api.signInEmail({ body: { email, password } })` succeeds; user `name` updated and `emailVerified: true`; one `credential` account; `preview` now → 410 `INVITATION_ACCEPTED`; password of 7 chars → `BadRequestException`.
  - `accept` twice concurrently (`Promise.allSettled`) → one fulfilled, one rejected with 410; one credential account.
  - `resend`: new email, previous token → 404, new token works, `expiresAt` renewed; after accept → 409 `ALREADY_ACCEPTED`.
  - `cancel`: user, organization, team and invitation gone; after accept → 409 `ALREADY_ACCEPTED` and everything still there.
  - `forOrganization` / `forUsers`: pending → `status: "pending"`; past expiry → `"expired"`; accepted → `null` / omitted.
- [ ] **Step 2:** Run it. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Notes:
  - Errors: Nest exceptions with `{ message, code }` bodies, e.g. `new ConflictException({ message: "Email is already in use", code: "EMAIL_TAKEN" })`.
  - Status derivation in one helper `statusOf(row, now)`.
  - Rollback: wrap steps after `createUser` in `try`; on failure delete the organization by `slug` (if created) and the user by id, then rethrow (map Better Auth `ORGANIZATION_ALREADY_EXISTS` → `SLUG_TAKEN`).
  - `accept` in `db.transaction`: first `update(accountInvitation).set({ acceptedAt: now }).where(and(eq(tokenHash), isNull(acceptedAt), gt(expiresAt, now))).returning()`; zero rows → re-read to pick 404/410; then insert the account `{ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash, createdAt, updatedAt }` and update the user.
  - `cancel` deletes the organization (and clears `session.activeOrganizationId` like `OrganizationsService.remove`) then the user.
- [ ] **Step 4:** Run it. Expected: PASS. Run all `apps/api` tests (the `sendEmail` move). Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): account invitations service`.

### Task 4: Account invitation routes

**Files:**
- Create: `apps/api/src/account-invitations/account-invitations.module.ts`, `admin-account-invitations.controller.ts` (+ `.spec.ts`), `account-invitations.controller.ts` (+ `.spec.ts`)
- Modify: `apps/api/src/app.module.ts` (register module)
- Modify: `apps/api/src/admin/organizations/organizations.service.ts` (`get` adds `ownerSetup`; it queries `accountInvitation` itself, reusing the exported `statusOf`, so `AdminModule` doesn't depend on the new module), its spec
- Create: `apps/api/test/account-invitations.e2e-spec.ts`
- Modify: `docs/routes.md`

**Interfaces:**
- Consumes: Task 3's service and DTOs.
- Produces (HTTP, all under `/api`):
  - `POST admin/account-invitations` — `@RequirePermissions({ user: ["create"], organization: ["create"] })`, body `CreateAccountInvitationBody`, 201 `{ id, organizationId, userId }`. Inviter from the session the `AuthGuard` attaches (read how `admin.controller.ts`/the guard exposes it); locale `requestLocale(req.headers)`.
  - `GET admin/account-invitations?userIds=a,b` — `{ user: ["list"] }` → `(OwnerSetup & { userId })[]`.
  - `POST admin/account-invitations/:id/resend` — `{ user: ["create"] }` → `OwnerSetup`.
  - `DELETE admin/account-invitations/:id` — `{ user: ["delete"], organization: ["delete"] }`, 204.
  - `GET account-invitations/:token` → `{ email, organizationName }`; `POST account-invitations/:token/accept` body `AcceptAccountInvitationBody` → 200 `{ email }`. No `AuthGuard`.
  - `OrganizationDetail.ownerSetup: OwnerSetup | null`.
- Swagger: `@ApiTags("admin")` / `@ApiTags("account-invitations")`, `@ApiOperation` on every route, `@ApiConflictResponse`/`@ApiGoneResponse`/`@ApiNotFoundResponse` where they apply.

- [ ] **Step 1: Failing tests:** controller specs with a mocked service (like `organizations.controller.spec.ts`): each route calls the service with the right arguments; the admin controller's routes carry the permissions above (read the `RequirePermissions` metadata as the existing controller spec does); the public controller has no guard. `organizations.service.spec.ts`: `get` returns `ownerSetup: null` for an org without invitation and the pending summary for one with a seeded row. e2e: `POST /admin/account-invitations` without session → 401; `GET /account-invitations/unknown` → 404.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and register the module.
- [ ] **Step 4:** `bun run test` and `bun run test:e2e` in `apps/api`. Expected: PASS. (e2e needs `DATABASE_URL`; if it isn't set locally, report that instead of claiming a pass.)
- [ ] **Step 5:** `docs/routes.md`: API rows for the five routes, `GET /api/admin/organizations/:id` row mentions owner setup. Commit `feat(api): account invitation routes`.

### Task 5: Admin console — invite, owner setup, impersonate

**Files:**
- Modify: `apps/web/src/lib/admin-api.ts` (types + calls)
- Create: `apps/web/src/containers/admin-organizations/components/invite-client-dialog.tsx`
- Modify: `admin-organizations.context.tsx`, `.page.tsx`, `.container.test.tsx`
- Create: `apps/web/src/containers/admin-organization/components/owner-setup-card.tsx`
- Modify: `admin-organization.context.tsx`, `.page.tsx`, `components/members-card.tsx`, `.container.test.tsx`
- Modify: `apps/web/src/containers/admin-users/*` (badge), its test
- Modify: `packages/i18n/messages/*.json`, `docs/routes.md`

**Interfaces:**
- Consumes: Task 4's routes.
- Produces in `admin-api.ts`: `type OwnerSetup = { id: string; email: string; expiresAt: string; status: "pending" | "expired" }`; `OrganizationDetail.ownerSetup: OwnerSetup | null`; `adminApi.inviteClient(body: { email: string; organizationName: string; slug: string }): Promise<{ id: string; organizationId: string; userId: string }>`, `adminApi.resendAccountInvitation(id): Promise<OwnerSetup>`, `adminApi.cancelAccountInvitation(id): Promise<void>`, `adminApi.accountInvitationsFor(userIds: string[]): Promise<(OwnerSetup & { userId: string })[]>`.
- Context additions: organizations → `inviteClient(input): Promise<string | null>` (error message or null, like `createOrganization`), `isInviting`; organization → `resendOwnerSetup()`, `cancelOwnerSetup()` (on success navigate to `/admin/organizations`), `impersonate(userId)` from `useAdminUserActions`.
- Errors: map `ApiError` 409 messages by code to field errors in the dialog (`EMAIL_TAKEN` → email field, `SLUG_TAKEN` → slug field); others through `adminErrorMessage`. (The controller error body carries `code`; extend `ApiError` with an optional `code` read from the JSON body.)

- [ ] **Step 1: Failing tests** (mock `adminApi` as the existing container tests do):
  - organizations: "Invite client" opens the dialog; typing the name fills the slug via `slugify`; submit calls `inviteClient` with `{ email, organizationName, slug }` and navigates to the new org; a 409 `EMAIL_TAKEN` shows the error under the email field.
  - organization: with `ownerSetup.status === "pending"` the card shows the email, a "Pending" badge, and Resend calls `resendAccountInvitation`; Cancel asks for confirmation then calls `cancelAccountInvitation` and navigates to the list; `"expired"` shows an "Expired" badge; `null` hides the card. A member row's menu has "Impersonate" calling `authClient.admin.impersonateUser({ userId })`.
  - users: a user returned by `accountInvitationsFor` shows a "Pending setup" badge.
- [ ] **Step 2:** `bun run test` in `apps/web`. Expected: FAIL.
- [ ] **Step 3:** Implement; dialog mirrors `create-organization-dialog.tsx`; card uses shadcn `Card`, `Badge`, `AlertDialog` already in `@workspace/ui`. New strings: `admin_org_invite`, `admin_org_invite_description` ("Creates the account and its organization, and emails the owner a link to set up their login."), `admin_org_invite_submit`, `admin_org_invite_email_label`, `admin_toast_client_invited`, `admin_owner_setup_title`, `admin_owner_setup_pending`, `admin_owner_setup_expired`, `admin_owner_setup_expires` ("Link expires {date}"), `admin_owner_setup_resend`, `admin_owner_setup_cancel`, `admin_owner_setup_cancel_confirm` ("This deletes {email}'s account and this organization."), `admin_toast_owner_setup_resent`, `admin_toast_owner_setup_cancelled`, `admin_user_pending_setup`, `admin_error_email_taken`, `admin_error_slug_taken` — with pt-BR.
- [ ] **Step 4:** `bun run test`, `bun run typecheck`, `bun run lint` in `apps/web`. Expected: PASS.
- [ ] **Step 5:** `docs/routes.md` rows for `/admin/organizations`, `/admin/organizations/$organizationId`, `/admin/users`. Commit `feat(web): invite clients from the admin console`.

### Task 6: `/welcome/$token`

**Files:**
- Create: `apps/web/src/routes/welcome/$token.tsx`
- Create: `apps/web/src/containers/welcome/{index.ts,welcome.container.tsx,welcome.page.tsx,welcome.context.tsx,welcome.container.test.tsx,components/welcome-form.tsx}`
- Create: `apps/web/src/lib/account-invitations-api.ts`
- Modify: `packages/i18n/messages/*.json`, `docs/routes.md`

**Interfaces:**
- Consumes: public routes from Task 4.
- Produces: `accountInvitationsApi.preview(token): Promise<{ email: string; organizationName: string }>`, `accountInvitationsApi.accept(token, { name, password }): Promise<{ email: string }>` (through `apiJson`).
- Context exposes `state: "loading" | "ready" | "invalid" | "expired" | "accepted"`, `preview`, `session` (from `authClient.useSession()`), `accept(input): Promise<string | null>`, `signOut()`. `accept` calls the API, then `authClient.signIn.email({ email, password })`, then `navigate({ to: "/" })`.
- Route is public: no guard; the page handles signed-in visitors itself.

- [ ] **Step 1: Failing tests:**
  - valid: shows the organization name and the email read-only; name + password + confirmation; mismatched confirmation or a 7-char password shows the error from `lib/password-policy.ts` without calling the API; valid submit calls `accept` then `signIn.email` with that email/password and navigates to `/`.
  - preview 410 with code `INVITATION_EXPIRED` → expired message; `INVITATION_ACCEPTED` → "already set up" with a link to `/sign-in`; 404 → invalid link.
  - signed in as someone (mock `useSession`) → "You're signed in as {email}" and a sign-out button; no form.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement following the container pattern (`sign-up` is the closest reference for the form). Strings: `welcome_title` ("Set up your account"), `welcome_description` ("You've been invited to manage {organization} on Platform Base."), `welcome_name_label`, `welcome_submit` ("Create my login"), `welcome_expired` ("This link has expired. Ask whoever invited you to send a new one."), `welcome_accepted` ("Your account is already set up."), `welcome_sign_in`, `welcome_invalid` ("This link isn't valid."), `welcome_signed_in_as` ("You're signed in as {email}. Sign out to set up the invited account."), `welcome_sign_out` — with pt-BR.
- [ ] **Step 4:** `bun run test`, `typecheck`, `lint` in `apps/web` (the route tree regenerates on build/dev; run `bun run build` once if typecheck needs it). Expected: PASS.
- [ ] **Step 5:** `docs/routes.md` row for `/welcome/$token`. Commit `feat(web): welcome page to finish an invited account`.

### Task 7: Closed sign-up in the web

**Files:**
- Modify: `apps/web/src/containers/sign-in/components/sign-in-form.tsx` + test
- Modify: `apps/web/src/containers/sign-up/*` + test
- Modify: `apps/web/src/containers/onboarding/*` (delete `components/create-organization-form.tsx` and its use) + test
- Modify: `packages/i18n/messages/*.json` (remove now-unused onboarding create strings), `docs/routes.md`

**Interfaces:** none new. The sign-in form shows the sign-up link only when the auth search carries an `email` (it's an invitation flow); the sign-up page without `?email=` shows the invite-only notice instead of the form.

- [ ] **Step 1: Failing tests:**
  - sign-in: no link to `/sign-up` by default; with `?redirect=/invitations/i1&email=jane@example.com` the link to `/sign-up?redirect=%2Finvitations%2Fi1&email=jane%40example.com` is still there (update the existing "links to the sign-up page" test).
  - sign-up: without `email` → `sign_up_invite_only` ("Platform Base is invite-only. If you were invited, use the link in your email.") and a link to `/sign-in`, no form; with `email` → the form as today; a `SIGN_UP_DISABLED` error from the API shows its message.
  - onboarding: no create-organization form; with pending invitations they're listed as today; without → `onboarding_no_organization` ("You're not in an organization yet. Ask your organization's admin to invite you."), plus links to security settings and sign out.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; remove dead code and messages (search both JSON files for keys no longer referenced).
- [ ] **Step 4:** `bun run test`, `typecheck`, `lint` in `apps/web`. Expected: PASS.
- [ ] **Step 5:** `docs/routes.md` rows `/sign-in`, `/sign-up`, `/onboarding`. Commit `feat(web): invite-only sign-up`.

### Task 8: Whole-branch verification

- [ ] **Step 1:** From the repo root: `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`. Expected: all PASS (agents workspace unaffected).
- [ ] **Step 2:** Check `docs/routes.md` against the spec §5 list; grep `apps/web/src/routes` for every route in the table.
- [ ] **Step 3:** Report to the user what still needs doing outside the repo: `bun run db:migrate` against Neon for migration 0004, and that existing users are unaffected while new self-service sign-ups stop.

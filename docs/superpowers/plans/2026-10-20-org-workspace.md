# Organization Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regular users create their organization at onboarding, then invite people, manage members and teams, and manage the organization's settings, all on Better Auth's organization plugin.

**Architecture:** The API only reconfigures the organization plugin (one org per user, 7-day invitations, invitation email, a `beforeAcceptInvitation` hook). The web calls `authClient.organization.*` directly from feature contexts (TanStack Query), under a pathless `_workspace` layout route that guards for an active organization and reuses the admin console's sidebar shell.

**Tech Stack:** Better Auth 1.7.10 (organization plugin), NestJS 12, Resend, React 19, TanStack Router/Query, shadcn (Base UI, hugeicons), Paraglide i18n, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-10-20-org-workspace-design.md`

## Global Constraints

- Better Auth stays at `1.7.10`; no new dependencies, no migrations (organization/member/invitation/team/team_member tables exist).
- Plugin options exactly: `teams: { enabled: true }`, `organizationLimit: 1`, `invitationExpiresIn: 7 * 24 * 60 * 60`, `cancelPendingInvitationsOnReInvite: true`, `requireEmailVerificationOnInvitation: true`.
- Organization roles are the plugin defaults `owner | admin | member`; UI permission checks use `authClient.organization.checkRolePermission({ role, permissions })`, never role-name comparisons (except "only owners may assign `owner`").
- Every user-facing string is a Paraglide message in both `packages/i18n/messages/en.json` and `pt-BR.json` (prefix `org_` for the workspace, `invitation_` for the invitation page, `onboarding_` for onboarding); run `bun run build` in `packages/i18n` after adding messages.
- Follow AGENTS.md: container pattern, `.js` relative imports in the API, Biome formatting (`bun run format`, then revert any change it makes to `apps/api/drizzle/meta/*` or `packages/ui/src/styles/globals.test.ts`), Conventional Commits with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- Every route change updates `docs/routes.md` in the same commit (AGENTS.md "Routes map").
- Never commit or push on `main`; work on `feat/org-workspace` (check `git branch --show-current` before each commit).
- Scope adjustments made while planning (data the plugin doesn't return cheaply): the members table shows role and join date (no per-member team column); the teams list shows the plugin-maintained `memberCount` (no avatars). `/settings/security` stays outside the workspace layout so superadmins and users without an organization keep reaching it.

## Review Focus

1. A user already in an organization opens an invitation link → a clear translated refusal, not a second membership. (Task 1 hook test + Task 9 page test.)
2. `?redirect=` on sign-in/sign-up pointing off-site (`https://evil.example`, `//evil.example`) → ignored, falls back to `/`. (Task 3 test.)
3. The only owner tries to leave, or transfers ownership and the second call fails → never ends with zero owners; promote happens before demote, and a failed demote leaves two owners and shows the error. (Task 8 tests.)
4. A member (not owner/admin) on any workspace page → no management controls rendered. (Tasks 6–8 tests.)
5. Session without `activeOrganizationId` but the user is a member (e.g. new device) → guard sets it and the dashboard loads instead of looping to onboarding. (Task 4 test.)

---

### Task 1: API — organization plugin config, invitation email, one-organization hook

**Files:**
- Modify: `apps/api/src/lib/auth.ts` (organization plugin options; `sendInvitationEmail`; `organizationHooks.beforeAcceptInvitation`)
- Modify: `packages/i18n/messages/en.json`, `pt-BR.json`
- Test: `apps/api/src/lib/organization.spec.ts` (new)

**Interfaces:**
- Produces: invitation email link `${WEB_URL}/invitations/${invitation.id}?email=${encodeURIComponent(email)}`; error code `ALREADY_IN_AN_ORGANIZATION` (HTTP 403) with message key `auth_error_ALREADY_IN_AN_ORGANIZATION`.
- Messages: `email_invitation_subject({ organization })`, `email_invitation_body({ inviter, organization, role })`, `email_invitation_link()`, `email_invitation_expiry({ days })`, role labels reuse `admin_member_role_owner|admin|member`.

- [ ] **Step 1: Write the failing tests** in `organization.spec.ts`, modelled on `src/lib/admin.spec.ts` (memory adapter with tables `user, session, account, verification, twoFactor, organization, member, invitation, team, teamMember`; Resend mocked with `vi.mock("resend")` capturing `emails.send` calls; users marked `emailVerified: true` directly in the memory db after sign-up):
  - `sends the invitation in the invitee's locale with org, inviter, role and link` — owner (locale en) invites `pt@example.com` whose user has `locale: "pt-BR"`; expect one send with `to: "pt@example.com"`, subject from `m.email_invitation_subject({ organization: "Acme" }, { locale: "pt-BR" })`, html containing `/invitations/<id>?email=pt%40example.com`, the inviter's name and the pt-BR role label.
  - `falls back to the inviter's request locale for an unknown invitee` — invitee without an account, request `Accept-Language: pt-BR` → pt-BR subject.
  - `re-inviting cancels the previous invitation` — invite twice; first invitation's status is `canceled`, a second email is sent.
  - `requires a verified email to accept` — invitee with `emailVerified: false` → 403 `EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION`.
  - `refuses an invitation for someone already in an organization` — invitee owns another org → 403, `body.code === "ALREADY_IN_AN_ORGANIZATION"`, message equals `m.auth_error_ALREADY_IN_AN_ORGANIZATION({}, { locale: "en" })`; no member row added.
  - `blocks creating a second organization` — `organization/create` twice → second fails with `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS`.
  - `invitations expire after 7 days` — `expiresAt - createdAt` ≈ 604 800 000 ms (±5 s).
- [ ] **Step 2: Run** `cd apps/api && bunx vitest run src/lib/organization.spec.ts` — expect failures (no email sent, no hook, limit unset).
- [ ] **Step 3: Implement.** In `auth.ts` set the Global Constraints options; `sendInvitationEmail: async ({ email, invitation, inviter, organization }, request)` looks the invitee up with the Drizzle `db` already used by `auth.ts` (`db.select().from(user).where(eq(user.email, email))`), picks `userLocale(invitee, request?.headers)` and sends through the existing `sendEmail`. `beforeAcceptInvitation: async ({ user })` → if `db` has any `member` row for `user.id`, `throw new APIError("FORBIDDEN", { code: "ALREADY_IN_AN_ORGANIZATION", message: "User already belongs to an organization" })`. Add the email messages and `auth_error_ALREADY_IN_AN_ORGANIZATION` (en: "You already belong to an organization. Leave it before accepting another invitation." / pt-BR: "Você já faz parte de uma organização. Saia dela antes de aceitar outro convite."), then build `packages/i18n`.
- [ ] **Step 4: Run** the spec plus `bunx vitest run src/i18n src/lib src/admin` — all pass (the superadmin `organizations.service.spec.ts` creates orgs for distinct users; if a test reuses an owner, give it a fresh user — that is the intended new behaviour).
- [ ] **Step 5: Commit** `feat(api): one organization per user and invitation emails`.

### Task 2: Web — extract the sidebar shell for reuse

**Files:**
- Create: `apps/web/src/components/shell/nav-main.tsx`, `apps/web/src/components/shell/app-header.tsx` (moved from `containers/admin/components/nav-main.tsx` and `admin-header.tsx`)
- Modify: `containers/admin/components/admin-sidebar.tsx`, `containers/admin/admin.page.tsx` (import from the new paths)

**Interfaces:**
- Produces: `NavMain({ label, items }: { label: string; items: NavItem[] })` and `export type NavItem` (unchanged shape); `AppHeader()` (SidebarTrigger + breadcrumbs from `useBreadcrumbs`).

- [ ] **Step 1:** Move the files with `git mv`, rename `AdminHeader` → `AppHeader`, fix imports.
- [ ] **Step 2: Run** `cd apps/web && bun run typecheck && bunx vitest run src/containers/admin*` — existing admin tests pass unchanged (this refactor has no new behaviour, the existing tests are its gate).
- [ ] **Step 3: Commit** `refactor(web): share the sidebar shell between admin and workspace`.

### Task 3: Web — sign-in/sign-up return to a page

**Files:**
- Create: `apps/web/src/lib/redirect-target.ts`, `redirect-target.test.ts`
- Modify: `routes/(auth)/sign-in.tsx`, `routes/(auth)/sign-up.tsx` (`validateSearch`), `containers/sign-in/sign-in.context.tsx`, `containers/sign-up/sign-up.context.tsx` + their forms (email default/locked), `containers/two-factor/two-factor.context.tsx`, `lib/auth-guards.ts` (`redirectIfSignedIn` honours `redirect`)

**Interfaces:**
- Produces: `type AuthSearch = { redirect?: string; email?: string }`; `parseAuthSearch(search: Record<string, unknown>): AuthSearch`; `safeRedirect(target: string | undefined): string` — returns `target` only if it starts with `/` and not `//`, else `"/"`.

- [ ] **Step 1: Tests:**
  - `redirect-target.test.ts`: `safeRedirect("/invitations/abc?email=a%40b.c")` keeps it; `undefined`, `"https://evil.example"`, `"//evil.example"`, `"javascript:alert(1)"` → `"/"`; `parseAuthSearch({ redirect: "/x", email: "a@b.c", other: 1 })` → `{ redirect: "/x", email: "a@b.c" }`.
  - `sign-in.container.test.tsx` (extend): with search `{ redirect: "/invitations/i1", email: "jane@example.com" }` the email field is prefilled and read-only, success navigates to `/invitations/i1`, magic link/social send `callbackURL` = `appURL("/invitations/i1")`, the 2FA branch navigates to `{ to: "/two-factor", search: { redirect: "/invitations/i1" } }`.
  - `sign-up.container.test.tsx` (extend): `callbackURL: appURL("/invitations/i1")`, prefilled read-only email.
  - `two-factor.container.test.tsx` (extend): success navigates to the redirect.
  - `auth-guards.test.ts` (extend): `redirectIfSignedIn({ search: { redirect: "/invitations/i1" } })` throws redirect to `/invitations/i1`.
- [ ] **Step 2: Run** `cd apps/web && bunx vitest run src/lib src/containers/sign-in src/containers/sign-up src/containers/two-factor` — new cases fail.
- [ ] **Step 3: Implement** with `Route.useSearch()` read in each context; `redirectIfSignedIn` takes TanStack's `beforeLoad` argument `({ search }: { search: AuthSearch })`.
- [ ] **Step 4: Run** the same command — pass.
- [ ] **Step 5: Commit** `feat(web): return to the requested page after sign-in and sign-up`.

### Task 4: Web — organization guards and workspace shell

**Files:**
- Modify: `apps/web/src/lib/auth-guards.ts` (+ tests); delete `routes/index.tsx` and `containers/home/` (replaced)
- Create: `routes/_workspace.tsx` (layout: `beforeLoad: requireOrganization`, renders `WorkspaceContainer`). The `/` child (`routes/_workspace/index.tsx`) comes in Task 6; implement Tasks 4 and 6 back-to-back and commit them together so `/` never 404s.
- Create: `containers/workspace/` (`workspace.container.tsx`, `workspace.page.tsx`, `workspace.context.tsx`, `components/workspace-sidebar.tsx`, `index.ts`), `lib/organization.ts`

**Interfaces:**
- Produces in `auth-guards.ts`: `requireOrganization(): Promise<{ session }>` — no session → `/sign-in`; admin access → `/admin`; no membership (`authClient.organization.list()` empty) → `/onboarding`; `session.session.activeOrganizationId` null → `authClient.organization.setActive({ organizationId: orgs[0].id })`. `requireNoOrganization()` — no session → `/sign-in`; has a membership → `/`. `requireUser` is removed (its only caller was `/`).
- Produces in `lib/organization.ts`: `ORGANIZATION_QUERY_KEY = ["organization"] as const`; `type OrgRole = "owner" | "admin" | "member"`; `can(role: OrgRole | undefined, permissions: Record<string, string[]>): boolean` (wraps `checkRolePermission`, false when role undefined).
- Produces in `workspace.context.tsx`: `useWorkspace(): { organization: FullOrganization | undefined; role: OrgRole | undefined; userId: string | undefined; can(permissions): boolean; isLoading: boolean; signOut(): Promise<void> }` where `FullOrganization` = the return type of `authClient.organization.getFullOrganization` data; query key `[...ORGANIZATION_QUERY_KEY, "full"]`.
- Sidebar items: Dashboard `/`, Teams `/teams`, Members `/members`, Settings `/settings/organization`; footer: user menu (Security `/settings/security`, Sign out).

- [ ] **Step 1: Tests:** `auth-guards.test.ts` — `requireOrganization`: signed out → `/sign-in`; admin → `/admin`; no orgs → `/onboarding`; member with null active org → `setActive` called with the first org id, resolves; member with active org → no `setActive`. `requireNoOrganization`: member → `/`; no orgs → resolves. `lib/organization.test.ts` — `can("member", { member: ["create"] })` false, `can("admin", { member: ["create"] })` true, `can("admin", { organization: ["delete"] })` false, `can(undefined, …)` false. `workspace.container.test.tsx` — renders the org name in the sidebar header, the four nav links (Settings is visible to every role; its controls are gated in Task 8), and the user menu's Sign out navigates to `/sign-in`.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement**; regenerate the route tree with `bunx @tanstack/router-cli generate` (never hand-edit `routeTree.gen.ts`).
- [ ] **Step 4: Run** `bun run typecheck && bunx vitest run src/lib src/containers/workspace` — pass.
- [ ] **Step 5:** Commit together with Task 6 (see Task 4 Files note).

### Task 5: Web — onboarding

**Files:** Create `containers/onboarding/` (container, page, context, `components/create-organization-form.tsx`, `components/pending-invitations.tsx`, index), test `onboarding.container.test.tsx`; route `routes/onboarding.tsx` (`beforeLoad: requireNoOrganization`). Move `slugify` from `containers/admin-organizations/admin-organizations.search.ts` to `lib/slugify.ts` (re-export removed; update the admin import and its test).

**Interfaces:**
- Consumes: `slugify(name: string): string`; `ORGANIZATION_QUERY_KEY`.
- Context: `createOrganization({ name, slug }): Promise<string | null>` (error message or null; on success `navigate({ to: "/" })`); `slugTaken: boolean | undefined` from a debounced (300 ms) `organization.checkSlug({ slug })`; `invitations` from `organization.listUserInvitations()` filtered to `status === "pending"`; `accept(invitationId)` → `acceptInvitation` then `navigate({ to: "/" })`.

- [ ] **Step 1: Tests:** typing "Acme Inc" fills slug `acme-inc`; a taken slug shows `m.onboarding_slug_taken()` and disables submit; submit calls `organization.create({ name: "Acme Inc", slug: "acme-inc" })` and navigates to `/`; API error is shown inline; a pending invitation lists org name and role and "Accept" calls `acceptInvitation({ invitationId })`; the `ALREADY_IN_AN_ORGANIZATION` error from accept is shown as a toast.
- [ ] **Step 2–4:** run (fail) → implement → run (pass) with `bunx vitest run src/containers/onboarding src/containers/admin-organizations`.
- [ ] **Step 5: Commit** `feat(web): onboarding to create an organization` (include `docs/routes.md` row for `/onboarding`).

### Task 6: Web — dashboard

**Files:** Create `containers/dashboard/` (container, page, context, `components/stat-cards.tsx`, `components/my-teams.tsx`, `components/recent-members.tsx`, index) + test; `routes/_workspace/index.tsx` renders `DashboardContainer`.

**Interfaces:** Consumes `useWorkspace()`. Context adds `myTeams` from `organization.listUserTeams()` (key `[...ORGANIZATION_QUERY_KEY, "my-teams"]`).

- [ ] **Step 1: Tests:** cards show members count, teams count, pending invitations count (`status === "pending"`); "My teams" lists the user's teams; recent members shows the 5 newest by `createdAt`; owner/admin see "Invite people" (→ `/members?invite=1`) and "New team" (→ `/teams?new=1`) shortcuts, a member sees neither.
- [ ] **Step 2–4:** fail → implement → pass (`bunx vitest run src/containers/dashboard src/containers/workspace src/lib`).
- [ ] **Step 5: Commit** (with Task 4) `feat(web): organization workspace with dashboard` — update `docs/routes.md` (`/` row, remove the temporary home description), delete the unused `home_*` messages.

### Task 7: Web — members and invitations

**Files:** Create `containers/members/` (container, page, context, `components/members-table.tsx`, `components/invitations-table.tsx`, `components/invite-dialog.tsx`, index) + test; `routes/_workspace/members.tsx` with `validateSearch` `{ tab?: "invitations"; invite?: 1 }`. Reuse `components/admin/confirm-dialog.tsx` and `containers/admin-organization/components/role-select.tsx` (move `RoleSelect` + `memberRoleLabel` to `components/role-select.tsx`; update the admin import).

**Interfaces:** Context: `invite({ email, role, teamId? }): Promise<string | null>`; `resend(invitation)` → `inviteMember({ email, role, teamId, resend: true })`; `cancel(invitationId)`; `updateRole(memberId, role)`; `remove(memberId)`. All invalidate `ORGANIZATION_QUERY_KEY`; success toasts; one-click errors toast.

- [ ] **Step 1: Tests:** members table rows (name, email, role badge, joined date); owner changes Bob's role → `updateMemberRole({ memberId, role: "admin" })`; the role select offers "Owner" only when the viewer is owner; remove asks for confirmation then `removeMember({ memberIdOrEmail: memberId })`; invite dialog submits `inviteMember({ email: "new@example.com", role: "member", teamId: "t1" })` and keeps the dialog open with the translated error on failure; `?invite=1` opens the dialog on load; invitations tab lists pending only, "Resend" sends `resend: true`, "Cancel" calls `cancelInvitation({ invitationId })`; a member sees no invite button, no role select (plain badge), no remove buttons.
- [ ] **Step 2–4:** fail → implement → pass.
- [ ] **Step 5: Commit** `feat(web): manage organization members and invitations` (+ `docs/routes.md`).

### Task 8: Web — teams, team detail, organization settings

**Files:**
- Create `containers/teams/` (list, create/rename dialog, delete confirm; `?new=1` opens create) + test; `routes/_workspace/teams/index.tsx`.
- Create `containers/team/` (team members list, add-member select from org members not in the team, remove) + test; `routes/_workspace/teams/$teamId.tsx` (breadcrumb title = team name).
- Create `containers/organization-settings/` (`components/general-card.tsx`, `components/danger-zone.tsx`, `components/transfer-ownership-dialog.tsx`, `components/delete-organization-dialog.tsx`) + test; `routes/_workspace/settings/organization.tsx`.

**Interfaces:**
- Teams: `createTeam({ name })`, `updateTeam({ teamId, data: { name } })`, `removeTeam({ teamId })`.
- Team: `listTeamMembers({ query: { teamId } })` (key `[...ORGANIZATION_QUERY_KEY, "team", teamId]`), `addTeamMember({ teamId, userId })`, `removeTeamMember({ teamId, userId })`.
- Settings: `update({ data: { name, slug } })`; `transferOwnership(memberId): Promise<string | null>` = `updateMemberRole({ memberId, role: "owner" })` then, only if that succeeded, `updateMemberRole({ memberId: ownMemberId, role: "admin" })`; `leave()` → `organization.leave({ organizationId })` then `navigate({ to: "/onboarding" })`; `deleteOrganization()` → `organization.delete({ organizationId })` then `/onboarding`.

- [ ] **Step 1: Tests:**
  - Teams: list with `memberCount`; create/rename/delete calls; `?new=1` opens the create dialog; members see no create/rename/delete.
  - Team: lists team members; add picks from org members not already in the team; remove calls `removeTeamMember`; members see no add/remove.
  - Settings: general form saves `{ name, slug }` and shows the slug-taken error inline; admins see general but not the danger zone's transfer/delete (they do see Leave); transfer calls promote then demote in order (assert `mock.invocationCallOrder`), and when the demote fails shows the error without a second attempt; Leave as only owner shows the translated `YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER` error; delete stays disabled until the typed name equals the org name exactly, then calls `delete` and navigates to `/onboarding`.
- [ ] **Step 2–4:** fail → implement → pass.
- [ ] **Step 5: Commit** `feat(web): teams and organization settings` (+ `docs/routes.md`).

### Task 9: Web — invitation page

**Files:** Create `containers/invitation/` (container, page, context, index) + test; `routes/invitations/$invitationId.tsx` with `validateSearch` `{ email?: string }` (public, no guard).

**Interfaces:** Consumes `authClient.useSession()`, `organization.getInvitation({ query: { id } })` (only when signed in with the matching email), `acceptInvitation`, `rejectInvitation`; sign-in/up links built with Task 3's `AuthSearch` (`redirect` = current path + search, `email`).

- [ ] **Step 1: Tests (one per state):** signed out → "Sign in" link to `/sign-in?redirect=%2Finvitations%2Fi1%3Femail%3D…&email=jane%40example.com` and "Create account" to `/sign-up` with the same search, no `getInvitation` call; signed in as another email → explains and "Sign out and continue" signs out then navigates to the sign-in link; signed in as the invitee → shows org name, inviter and role, Accept → `acceptInvitation({ invitationId: "i1" })` → navigates to `/`, Reject → `rejectInvitation` → shows "declined" state; `getInvitation` error `INVITATION_NOT_FOUND` → invalid/expired message with a link to `/`; accept error `ALREADY_IN_AN_ORGANIZATION` → shows that translated message.
- [ ] **Step 2–4:** fail → implement → pass.
- [ ] **Step 5: Commit** `feat(web): invitation page` (+ `docs/routes.md`).

### Task 10: Verify, document, open the PR

- [ ] **Step 1:** From the repo root: `bun run format` (revert drizzle meta / globals.test.ts if touched), `bun run lint`, `bun run typecheck`, `bun run test`, `cd apps/api && bun run test:e2e`, `cd apps/web && bun run build` — all green.
- [ ] **Step 2:** Confirm `docs/routes.md` lists `/onboarding`, `/`, `/members`, `/teams`, `/teams/$teamId`, `/settings/organization`, `/invitations/$invitationId` with access and goal; commit spec + plan (`docs: org workspace design and plan`) if not yet committed.
- [ ] **Step 3:** `git branch --show-current` = `feat/org-workspace`; push; `gh pr create --base main` with summary, setup notes (no migration; superadmin "New organization" now refuses owners who already have an org) and test results.

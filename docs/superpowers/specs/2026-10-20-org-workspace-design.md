# Organization workspace — design

Date: 2026-10-20 · Status: approved in conversation (section by section)

## Goal

Give every regular (non-superadmin) user an organization workspace: after signing up they create their organization, then invite people, create teams and put people in teams, and manage the organization's settings. Built on what Better Auth 1.7.10's organization plugin provides.

## Decisions

| Topic | Decision |
|---|---|
| How a user gets an organization | **Onboarding after sign-up**: a first-run screen creates it, or accepts a pending invitation. **One organization per user** (`organizationLimit: 1`; joining a second one is blocked too). |
| Roles | Better Auth defaults **owner / admin / member**; teams have no roles of their own. |
| Settings | **General** (name, slug with availability check; logo shown as initials, no upload) and **danger zone** (transfer ownership, leave, delete). Invitation policy and limits are platform config on the server. |
| Invitee without an account | **Keeps email verification**: signs up with the invited email prefilled/locked, verifies, the verification link returns to the invitation page, accepts. |
| Where the logic lives | **The web calls the Better Auth organization plugin directly** (`authClient.organization.*`), which enforces permissions, last-owner protection and expiry. The API only configures the plugin and sends invitation emails. No new Nest endpoints. |

## Routes (web)

| Route | Who | Content |
|---|---|---|
| `/` | user | Signed out → `/sign-in`; superadmin → `/admin`; no organization → `/onboarding`; otherwise the **dashboard** (members/teams/pending-invitation counts, "my teams", recent members; invite/create-team shortcuts for owner/admin). Replaces the temporary welcome page. |
| `/onboarding` | user without an org | Create the organization (name, suggested slug, `check-slug`); pending invitations received, with Accept. |
| `/members` | member (manage: owner/admin) | Members table (role, joined date; change role, remove) + **pending invitations** tab (resend, cancel) + Invite dialog (email, role, optional team). |
| `/teams` | member (manage: owner/admin) | Teams with member counts; create, rename, delete. |
| `/teams/$teamId` | member (manage: owner/admin) | Team members; add/remove organization members. |
| `/settings/organization` | owner/admin (danger zone: owner) | General + danger zone. |
| `/settings/security` | user | Unchanged and outside the workspace layout, so superadmins and users without an organization still reach it; linked from the workspace's user menu. |
| `/invitations/$invitationId` | public | Accept/reject; handles right email / other email / signed out / invalid / already in an org. |

All workspace routes share a sidebar-07 shell (organization name in the header, user menu in the footer) like the admin console. Members see every page but none of the management controls; the server rejects them regardless.

## Flows

- **Onboarding:** `organization.create({ name, slug })` → owner + default team + active organization → `/`.
- **Invite:** `organization.inviteMember({ email, role, teamId? })`; the API's `sendInvitationEmail` sends (Resend) "{inviter} invited you to {org} as {role}" with a link `${WEB_URL}/invitations/:id?email=…`, in the invitee's stored locale, else the inviter's request locale. Re-inviting cancels the previous invitation (`cancelPendingInvitationsOnReInvite`); "Resend" uses `resend: true`; "Cancel" uses `cancelInvitation`. Invitations last 7 days.
- **Accept page:** `getInvitation` requires a session whose email matches, so:
  - signed in with the invited email → details + Accept/Reject (`acceptInvitation` sets the active org and joins the invitation's team) → `/`;
  - signed in with another email → explain, offer "sign out and continue as {email}";
  - signed out → Sign in / Create account with the email from the link prefilled and locked; both return to the invitation page: `/sign-in` and `/sign-up` accept `?redirect=` (same-origin path) and `?email=`; sign-up's `callbackURL` becomes the invitation page, so the verification link lands there;
  - invalid/expired/cancelled → message + link home;
  - already a member of an organization → rejected by the `beforeAcceptInvitation` hook with a translated error.
- **Transfer ownership (owner):** promote the chosen member to owner, then demote self to admin (two `updateMemberRole` calls, in that order, behind a confirmation).
- **Leave:** `organization.leave`; the only owner is refused (plugin) and told to transfer first → `/onboarding`.
- **Delete (owner):** confirm by typing the organization name → `organization.delete` → `/onboarding`.
- **Active organization:** the `/` guard calls `setActive` with the user's organization when the session has none.
- **Superadmin console:** "New organization" now refuses an owner who already has an organization (the limit applies server-side); adding members from the console remains a superadmin override.

## Server configuration

```ts
organization({
  teams: { enabled: true },
  organizationLimit: 1,
  invitationExpiresIn: 7 * 24 * 60 * 60,
  cancelPendingInvitationsOnReInvite: true,
  requireEmailVerificationOnInvitation: true,
  sendInvitationEmail,
  organizationHooks: { beforeAcceptInvitation },
})
```

## Errors and i18n

- Better Auth's organization error codes are already translated (`auth_error_<CODE>`, en + pt-BR); `src/i18n/auth-i18n.spec.ts` fails if any enabled plugin's code lacks one.
- The "already in an organization" refusal uses a new code, `ALREADY_IN_AN_ORGANIZATION`, with its own `auth_error_` message.
- Form errors show inline in their dialog; one-click action errors are toasts (same as the admin console).
- Permission-dependent UI uses the client's `checkRolePermission` with the member's role in the active organization — the same rules the server applies.

## Testing

- **API** (Better Auth with the memory adapter, Resend mocked): invitation email content and locale; resend and cancel-previous; acceptance needs a verified email; the already-in-an-org refusal; a second organization blocked; translation of the new error code.
- **Web** (container tests, mocked `authClient`, user-event): onboarding, dashboard, members/invitations, teams, team detail, organization settings (transfer order, only-owner leave, delete confirmation), invitation page (each case), and the route guards.

## Out of scope

Logo upload; custom roles (dynamic access control); several organizations per user with a switcher; invitation-as-verification sign-up; per-organization invitation policy and limits.

import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";

type TeamMemberRow = {
	id: string;
	teamId: string;
	userId: string;
	createdAt: Date;
	membershipKey?: unknown;
};

/**
 * `GET /organization/team-members?teamId=` — a team's members, for any member
 * of the team's organization.
 *
 * The organization plugin's own `/organization/list-team-members` only
 * answers callers who are in that team, and creating a team doesn't add its
 * creator, so owners and admins couldn't see the teams they manage. Every
 * member can see every team (managing them is gated separately by the
 * plugin's own add/remove endpoints).
 */
export const teamMembers = {
	id: "team-members",
	endpoints: {
		listOrganizationTeamMembers: createAuthEndpoint(
			"/organization/team-members",
			{
				method: "GET",
				use: [sessionMiddleware],
				requireHeaders: true,
				metadata: {
					openapi: {
						description:
							"List a team's members; the caller must be a member of the team's organization",
						parameters: [
							{
								name: "teamId",
								in: "query",
								required: true,
								schema: { type: "string" },
							},
						],
					},
				},
			},
			async (ctx) => {
				const teamId = (ctx.query as { teamId?: unknown } | undefined)?.teamId;
				if (typeof teamId !== "string" || !teamId) {
					throw new APIError("BAD_REQUEST", {
						code: "TEAM_NOT_FOUND",
						message: "Team not found",
					});
				}

				const { adapter } = ctx.context;
				const team = await adapter.findOne<{ organizationId: string }>({
					model: "team",
					where: [{ field: "id", value: teamId }],
				});
				if (!team) {
					throw new APIError("NOT_FOUND", {
						code: "TEAM_NOT_FOUND",
						message: "Team not found",
					});
				}

				const membership = await adapter.findOne({
					model: "member",
					where: [
						{ field: "userId", value: ctx.context.session.user.id },
						{ field: "organizationId", value: team.organizationId },
					],
				});
				if (!membership) {
					throw new APIError("FORBIDDEN", {
						code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
						message: "User is not a member of the organization",
					});
				}

				const rows = await adapter.findMany<TeamMemberRow>({
					model: "teamMember",
					where: [{ field: "teamId", value: teamId }],
				});
				return ctx.json(
					rows.map(({ membershipKey: _membershipKey, ...row }) => row),
				);
			},
		),
	},
} satisfies BetterAuthPlugin;

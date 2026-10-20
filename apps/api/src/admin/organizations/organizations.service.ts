import { createHash, randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AUTH_INSTANCE } from "../../auth/auth.constants.js";
import { DATABASE_CONNECTION } from "../../database/database.module.js";
import * as schema from "../../database/schema.js";
import type {
	AddMemberBody,
	CreateOrganizationBody,
	ListOrganizationsQuery,
	MemberRole,
	UpdateOrganizationBody,
} from "./organizations.dto.js";

const { organization, member, invitation, team, teamMember, user } = schema;

type Db = NodePgDatabase<typeof schema>;

// `auth` is typed against the generic `BetterAuthOptions` (see lib/auth.ts),
// which erases the organization plugin's endpoints from its static type.
export type OrganizationsAuthApi = {
	api: {
		createOrganization: (input: {
			body: { name: string; slug: string; userId: string };
		}) => Promise<{ id: string } | null>;
	};
};

export type OrganizationSummary = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	createdAt: Date;
	memberCount: number;
	teamCount: number;
};

export type OrganizationDetail = Omit<
	OrganizationSummary,
	"memberCount" | "teamCount"
> & {
	members: {
		id: string;
		role: string;
		createdAt: Date;
		user: { id: string; name: string; email: string; image: string | null };
	}[];
	teams: {
		id: string;
		name: string;
		createdAt: Date;
		memberCount: number;
		userIds: string[];
	}[];
	invitations: {
		id: string;
		email: string;
		role: string | null;
		teamId: string | null;
		expiresAt: Date;
	}[];
};

/**
 * The organization plugin's team membership key: a hash of [teamId, userId]
 * behind a unique index. Mirrors `computeTeamMembershipKey` in
 * better-auth/dist/plugins/organization/adapter.mjs so rows written here are
 * indistinguishable from the plugin's own.
 */
export function teamMembershipKey(teamId: string, userId: string): string {
	return createHash("sha256")
		.update(JSON.stringify([teamId, userId]))
		.digest("base64url");
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const isOwner = (role: string) => role.split(",").includes("owner");

function isUniqueViolation(error: unknown): boolean {
	const { code, cause } = error as { code?: string; cause?: { code?: string } };
	return (code ?? cause?.code) === "23505";
}

/**
 * Superadmin management of every organization, across tenants. The
 * organization plugin's own endpoints only let members act inside their
 * orgs, so these go to the database directly — except creation, which goes
 * through the plugin so it adds the owner and default team itself.
 */
@Injectable()
export class OrganizationsService {
	constructor(
		@Inject(DATABASE_CONNECTION) private readonly db: Db,
		@Inject(AUTH_INSTANCE) private readonly auth: OrganizationsAuthApi,
	) {}

	async list({ search, limit, offset }: ListOrganizationsQuery): Promise<{
		organizations: OrganizationSummary[];
		total: number;
	}> {
		const pattern = search && `%${escapeLike(search)}%`;
		const where = pattern
			? or(ilike(organization.name, pattern), ilike(organization.slug, pattern))
			: undefined;

		const [organizations, total] = await Promise.all([
			this.db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					logo: organization.logo,
					createdAt: organization.createdAt,
					memberCount: this.db.$count(
						member,
						eq(member.organizationId, organization.id),
					),
					teamCount: this.db.$count(
						team,
						eq(team.organizationId, organization.id),
					),
				})
				.from(organization)
				.where(where)
				.orderBy(desc(organization.createdAt), organization.id)
				.limit(limit)
				.offset(offset),
			this.db.$count(organization, where),
		]);

		return { organizations, total };
	}

	async get(id: string): Promise<OrganizationDetail> {
		const [found] = await this.db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
				createdAt: organization.createdAt,
			})
			.from(organization)
			.where(eq(organization.id, id));
		if (!found) throw new NotFoundException("Organization not found");

		const [members, teams, teamMembers, invitations] = await Promise.all([
			this.db
				.select({
					id: member.id,
					role: member.role,
					createdAt: member.createdAt,
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						image: user.image,
					},
				})
				.from(member)
				.innerJoin(user, eq(member.userId, user.id))
				.where(eq(member.organizationId, id))
				.orderBy(member.createdAt),
			this.db
				.select({
					id: team.id,
					name: team.name,
					createdAt: team.createdAt,
					memberCount: team.memberCount,
				})
				.from(team)
				.where(eq(team.organizationId, id))
				.orderBy(team.createdAt),
			this.db
				.select({ teamId: teamMember.teamId, userId: teamMember.userId })
				.from(teamMember)
				.innerJoin(team, eq(teamMember.teamId, team.id))
				.where(eq(team.organizationId, id)),
			this.db
				.select({
					id: invitation.id,
					email: invitation.email,
					role: invitation.role,
					teamId: invitation.teamId,
					expiresAt: invitation.expiresAt,
				})
				.from(invitation)
				.where(
					and(
						eq(invitation.organizationId, id),
						eq(invitation.status, "pending"),
					),
				)
				.orderBy(invitation.createdAt),
		]);

		return {
			...found,
			members,
			teams: teams.map((t) => ({
				...t,
				userIds: teamMembers
					.filter(({ teamId }) => teamId === t.id)
					.map(({ userId }) => userId),
			})),
			invitations,
		};
	}

	async create({
		name,
		slug,
		ownerUserId,
	}: CreateOrganizationBody): Promise<OrganizationDetail> {
		await this.findUser(ownerUserId);
		try {
			const created = await this.auth.api.createOrganization({
				body: { name, slug, userId: ownerUserId },
			});
			if (!created) throw new BadRequestException("Failed to create");
			return await this.get(created.id);
		} catch (error) {
			throw toHttpException(error);
		}
	}

	async update(
		id: string,
		changes: UpdateOrganizationBody,
	): Promise<OrganizationDetail> {
		if (changes.name !== undefined || changes.slug !== undefined) {
			try {
				const updated = await this.db
					.update(organization)
					.set({ name: changes.name, slug: changes.slug })
					.where(eq(organization.id, id))
					.returning({ id: organization.id });
				if (updated.length === 0) {
					throw new NotFoundException("Organization not found");
				}
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ConflictException("Slug is already taken");
				}
				throw error;
			}
		}
		return this.get(id);
	}

	/** Members, invitations and teams go with it (ON DELETE CASCADE). */
	async remove(id: string): Promise<void> {
		const deleted = await this.db
			.delete(organization)
			.where(eq(organization.id, id))
			.returning({ id: organization.id });
		if (deleted.length === 0) {
			throw new NotFoundException("Organization not found");
		}
		// Sessions that had it active would otherwise point at nothing.
		await this.db
			.update(schema.session)
			.set({ activeOrganizationId: null, activeTeamId: null })
			.where(eq(schema.session.activeOrganizationId, id));
	}

	async addMember(
		organizationId: string,
		{ userId, role }: AddMemberBody,
	): Promise<OrganizationDetail> {
		await this.findOrganization(organizationId);
		await this.findUser(userId);
		const [existing] = await this.db
			.select({ id: member.id })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			);
		if (existing) {
			throw new ConflictException("User is already a member");
		}

		await this.db.insert(member).values({
			id: randomUUID(),
			organizationId,
			userId,
			role,
			createdAt: new Date(),
		});
		return this.get(organizationId);
	}

	async updateMemberRole(
		organizationId: string,
		memberId: string,
		role: MemberRole,
	): Promise<OrganizationDetail> {
		const found = await this.findMember(organizationId, memberId);
		if (isOwner(found.role) && role !== "owner") {
			await this.assertAnotherOwner(organizationId, memberId);
		}

		await this.db.update(member).set({ role }).where(eq(member.id, memberId));
		return this.get(organizationId);
	}

	async removeMember(
		organizationId: string,
		memberId: string,
	): Promise<OrganizationDetail> {
		const found = await this.findMember(organizationId, memberId);
		if (isOwner(found.role)) {
			await this.assertAnotherOwner(organizationId, memberId);
		}

		await this.db.transaction(async (tx) => {
			const teamIds = tx
				.select({ id: team.id })
				.from(team)
				.where(eq(team.organizationId, organizationId));
			const left = await tx
				.delete(teamMember)
				.where(
					and(
						eq(teamMember.userId, found.userId),
						inArray(teamMember.teamId, teamIds),
					),
				)
				.returning({ teamId: teamMember.teamId });
			await syncMemberCounts(
				tx,
				left.map(({ teamId }) => teamId),
			);
			await tx.delete(member).where(eq(member.id, memberId));
		});
		return this.get(organizationId);
	}

	async createTeam(
		organizationId: string,
		name: string,
	): Promise<OrganizationDetail> {
		await this.findOrganization(organizationId);
		await this.db.insert(team).values({
			id: randomUUID(),
			name,
			organizationId,
			memberCount: 0,
			createdAt: new Date(),
		});
		return this.get(organizationId);
	}

	async renameTeam(
		organizationId: string,
		teamId: string,
		name: string,
	): Promise<OrganizationDetail> {
		await this.findTeam(organizationId, teamId);
		await this.db.update(team).set({ name }).where(eq(team.id, teamId));
		return this.get(organizationId);
	}

	/** Its memberships go with it (ON DELETE CASCADE). */
	async removeTeam(
		organizationId: string,
		teamId: string,
	): Promise<OrganizationDetail> {
		await this.findTeam(organizationId, teamId);
		await this.db.delete(team).where(eq(team.id, teamId));
		await this.db
			.update(schema.session)
			.set({ activeTeamId: null })
			.where(eq(schema.session.activeTeamId, teamId));
		return this.get(organizationId);
	}

	async addTeamMember(
		organizationId: string,
		teamId: string,
		userId: string,
	): Promise<OrganizationDetail> {
		await this.findTeam(organizationId, teamId);
		const [orgMember] = await this.db
			.select({ id: member.id })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			);
		if (!orgMember) {
			throw new BadRequestException(
				"User must be a member of the organization first",
			);
		}

		try {
			await this.db.transaction(async (tx) => {
				await tx.insert(teamMember).values({
					id: randomUUID(),
					teamId,
					userId,
					membershipKey: teamMembershipKey(teamId, userId),
					createdAt: new Date(),
				});
				await syncMemberCounts(tx, [teamId]);
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException("User is already in this team");
			}
			throw error;
		}
		return this.get(organizationId);
	}

	async removeTeamMember(
		organizationId: string,
		teamId: string,
		userId: string,
	): Promise<OrganizationDetail> {
		await this.findTeam(organizationId, teamId);
		await this.db.transaction(async (tx) => {
			const deleted = await tx
				.delete(teamMember)
				.where(
					and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)),
				)
				.returning({ id: teamMember.id });
			if (deleted.length === 0) {
				throw new NotFoundException("User is not in this team");
			}
			await syncMemberCounts(tx, [teamId]);
		});
		return this.get(organizationId);
	}

	private async findOrganization(id: string) {
		const [found] = await this.db
			.select({ id: organization.id })
			.from(organization)
			.where(eq(organization.id, id));
		if (!found) throw new NotFoundException("Organization not found");
		return found;
	}

	private async findUser(id: string) {
		const [found] = await this.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, id));
		if (!found) throw new NotFoundException("User not found");
		return found;
	}

	private async findMember(organizationId: string, memberId: string) {
		const [found] = await this.db
			.select({ userId: member.userId, role: member.role })
			.from(member)
			.where(
				and(eq(member.id, memberId), eq(member.organizationId, organizationId)),
			);
		if (!found) throw new NotFoundException("Member not found");
		return found;
	}

	private async findTeam(organizationId: string, teamId: string) {
		const [found] = await this.db
			.select({ id: team.id })
			.from(team)
			.where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)));
		if (!found) throw new NotFoundException("Team not found");
		return found;
	}

	/** The plugin refuses to leave an org ownerless; so does the admin API. */
	private async assertAnotherOwner(organizationId: string, memberId: string) {
		const owners = await this.db
			.select({ id: member.id, role: member.role })
			.from(member)
			.where(eq(member.organizationId, organizationId));
		if (!owners.some(({ id, role }) => id !== memberId && isOwner(role))) {
			throw new BadRequestException(
				"An organization must keep at least one owner",
			);
		}
	}
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Recomputes `team.member_count`, which the plugin uses for team limits. */
async function syncMemberCounts(tx: Tx, teamIds: string[]) {
	if (teamIds.length === 0) return;
	await tx
		.update(team)
		.set({
			memberCount: sql`(${tx
				.select({ value: count() })
				.from(teamMember)
				.where(eq(teamMember.teamId, team.id))})`,
		})
		.where(inArray(team.id, [...new Set(teamIds)]));
}

/** Better Auth's APIError → the equivalent Nest HTTP error. */
function toHttpException(error: unknown): unknown {
	if (error instanceof HttpException) return error;
	const { statusCode, body } = error as {
		statusCode?: number;
		body?: { code?: string; message?: string };
	};
	if (typeof statusCode === "number") {
		return new HttpException(body ?? { message: String(error) }, statusCode);
	}
	return error;
}

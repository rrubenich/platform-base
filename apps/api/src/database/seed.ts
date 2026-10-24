import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { teamMembershipKey } from "../lib/team-membership-key.js";
import * as schema from "./schema.js";
import {
	SEED_ORGANIZATIONS,
	SEED_PASSWORD,
	SEED_USERS,
	type SeedOrganization,
} from "./seed-data.js";

// `bun run db:seed [--reset]`: writes the mock accounts and organizations of
// seed-data.ts to the database in DATABASE_URL. Existing rows are kept (a
// user or organization already there is skipped); --reset deletes the seeded
// ones first. Refuses to run with NODE_ENV=production.

const { user, account, organization, member, team, teamMember, invitation } =
	schema;

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type Db = NodePgDatabase<typeof schema>;

async function reset(db: Db) {
	const slugs = SEED_ORGANIZATIONS.map((org) => org.slug);
	const emails = SEED_USERS.map((seeded) => seeded.email);
	// Members, teams and invitations go with them (ON DELETE CASCADE).
	await db.delete(organization).where(inArray(organization.slug, slugs));
	await db.delete(user).where(inArray(user.email, emails));
	console.log("Deleted the seeded organizations and users.");
}

/** Creates the users not there yet; returns every seeded user's id by email. */
async function seedUsers(db: Db): Promise<Map<string, string>> {
	const ids = new Map<string, string>();
	const password = await hashPassword(SEED_PASSWORD);

	for (const seeded of SEED_USERS) {
		const [existing] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, seeded.email));
		if (existing) {
			ids.set(seeded.email, existing.id);
			console.log(`  = ${seeded.email} (exists)`);
			continue;
		}

		const id = randomUUID();
		const now = new Date();
		await db.transaction(async (tx) => {
			await tx.insert(user).values({
				id,
				name: seeded.name,
				email: seeded.email,
				emailVerified: true,
				role: seeded.role,
				createdAt: now,
				updatedAt: now,
			});
			await tx.insert(account).values({
				id: randomUUID(),
				accountId: id,
				providerId: "credential",
				userId: id,
				password,
				createdAt: now,
				updatedAt: now,
			});
		});
		ids.set(seeded.email, id);
		console.log(`  + ${seeded.email} (${seeded.role})`);
	}
	return ids;
}

async function seedOrganization(
	db: Db,
	seeded: SeedOrganization,
	userIds: Map<string, string>,
) {
	const [existing] = await db
		.select({ id: organization.id })
		.from(organization)
		.where(eq(organization.slug, seeded.slug));
	if (existing) {
		console.log(`  = ${seeded.name} (exists)`);
		return;
	}

	const idOf = (email: string) => {
		const id = userIds.get(email);
		if (!id) throw new Error(`Seed user ${email} is missing`);
		return id;
	};

	await db.transaction(async (tx) => {
		const now = new Date();
		const organizationId = randomUUID();
		await tx.insert(organization).values({
			id: organizationId,
			name: seeded.name,
			slug: seeded.slug,
			createdAt: now,
		});
		await tx.insert(member).values(
			seeded.members.map((seededMember) => ({
				id: randomUUID(),
				organizationId,
				userId: idOf(seededMember.email),
				role: seededMember.role,
				createdAt: now,
			})),
		);

		// The default team the plugin creates with an organization, named after
		// it, with everyone in it; then the extra teams.
		const teams = [
			{
				name: seeded.name,
				members: seeded.members.map((seededMember) => seededMember.email),
			},
			...seeded.teams,
		];
		const teamIds = new Map<string, string>();
		for (const seededTeam of teams) {
			const teamId = randomUUID();
			teamIds.set(seededTeam.name, teamId);
			await tx.insert(team).values({
				id: teamId,
				name: seededTeam.name,
				organizationId,
				memberCount: seededTeam.members.length,
				createdAt: now,
			});
			if (seededTeam.members.length === 0) continue;
			await tx.insert(teamMember).values(
				seededTeam.members.map((email) => ({
					id: randomUUID(),
					teamId,
					userId: idOf(email),
					membershipKey: teamMembershipKey(teamId, idOf(email)),
					createdAt: now,
				})),
			);
		}

		const owner = seeded.members.find(
			(seededMember) => seededMember.role === "owner",
		);
		if (seeded.invitations.length > 0 && owner) {
			await tx.insert(invitation).values(
				seeded.invitations.map((seededInvitation) => ({
					id: randomUUID(),
					organizationId,
					email: seededInvitation.email,
					role: seededInvitation.role,
					teamId: seededInvitation.team
						? teamIds.get(seededInvitation.team)
						: null,
					status: "pending",
					expiresAt: new Date(now.getTime() + INVITATION_EXPIRY_MS),
					inviterId: idOf(owner.email),
				})),
			);
		}
	});
	console.log(
		`  + ${seeded.name} (${seeded.members.length} members, ${seeded.teams.length + 1} teams, ${seeded.invitations.length} invitations)`,
	);
}

export async function seed(db: Db, options: { reset?: boolean } = {}) {
	if (options.reset) await reset(db);
	console.log("Users:");
	const userIds = await seedUsers(db);
	console.log("Organizations:");
	for (const seeded of SEED_ORGANIZATIONS) {
		await seedOrganization(db, seeded, userIds);
	}
	console.log(`\nEvery seeded account signs in with "${SEED_PASSWORD}".`);
}

if (import.meta.main) {
	if (process.env.NODE_ENV === "production") {
		console.error("Refusing to seed mock users with NODE_ENV=production.");
		process.exit(1);
	}
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		await seed(drizzle(pool, { schema }), {
			reset: process.argv.includes("--reset"),
		});
	} finally {
		await pool.end();
	}
}

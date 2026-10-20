import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gt, isNotNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import * as schema from "../database/schema.js";

export type AdminStats = {
	users: number;
	admins: number;
	bannedUsers: number;
	organizations: number;
	teams: number;
	activeSessions: number;
	impersonatedSessions: number;
};

export type GrowthPoint = {
	/** The day, as YYYY-MM-DD (UTC). */
	date: string;
	users: number;
	organizations: number;
};

@Injectable()
export class AdminService {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: NodePgDatabase<typeof schema>,
	) {}

	async getStats(): Promise<AdminStats> {
		const now = new Date();
		const total = async (query: Promise<{ value: number }[]>) =>
			(await query)[0]?.value ?? 0;

		const [
			users,
			admins,
			bannedUsers,
			organizations,
			teams,
			activeSessions,
			impersonatedSessions,
		] = await Promise.all([
			total(this.db.select({ value: count() }).from(schema.user)),
			// `role` can hold several comma-separated roles.
			total(
				this.db
					.select({ value: count() })
					.from(schema.user)
					.where(sql`'admin' = any(string_to_array(${schema.user.role}, ','))`),
			),
			total(
				this.db
					.select({ value: count() })
					.from(schema.user)
					.where(eq(schema.user.banned, true)),
			),
			total(this.db.select({ value: count() }).from(schema.organization)),
			total(this.db.select({ value: count() }).from(schema.team)),
			total(
				this.db
					.select({ value: count() })
					.from(schema.session)
					.where(gt(schema.session.expiresAt, now)),
			),
			total(
				this.db
					.select({ value: count() })
					.from(schema.session)
					.where(
						and(
							gt(schema.session.expiresAt, now),
							isNotNull(schema.session.impersonatedBy),
						),
					),
			),
		]);

		return {
			users,
			admins,
			bannedUsers,
			organizations,
			teams,
			activeSessions,
			impersonatedSessions,
		};
	}

	/**
	 * New users and organizations per day for the last `days` days (today
	 * included), with zero-filled gaps so the series charts directly.
	 */
	async getGrowth(days: number): Promise<GrowthPoint[]> {
		const { rows } = await this.db.execute<GrowthPoint>(sql`
			select
				to_char(day, 'YYYY-MM-DD') as date,
				(select count(*) from ${schema.user}
					where ${schema.user.createdAt} >= day
					and ${schema.user.createdAt} < day + interval '1 day')::int as users,
				(select count(*) from ${schema.organization}
					where ${schema.organization.createdAt} >= day
					and ${schema.organization.createdAt} < day + interval '1 day')::int as organizations
			from generate_series(
				date_trunc('day', now() at time zone 'utc') - make_interval(days => ${days - 1}),
				date_trunc('day', now() at time zone 'utc'),
				interval '1 day'
			) as day
			order by day
		`);
		return rows;
	}
}

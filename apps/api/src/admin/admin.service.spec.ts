import * as schema from "../database/schema.js";
import { createTestDatabase } from "../testing/test-database.js";
import { AdminService } from "./admin.service.js";

const { db, close } = await createTestDatabase();
const service = new AdminService(db as never);

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

beforeAll(async () => {
	await db.insert(schema.user).values([
		{ id: "u1", name: "Admin", email: "a@example.com", role: "admin" },
		{ id: "u2", name: "Both", email: "b@example.com", role: "user,admin" },
		{
			id: "u3",
			name: "Banned",
			email: "c@example.com",
			role: "user",
			banned: true,
		},
		// Not an admin, despite containing the letters.
		{
			id: "u4",
			name: "Sub",
			email: "d@example.com",
			role: "subadmin",
			createdAt: daysAgo(3),
		},
		{ id: "u5", name: "Old", email: "e@example.com", createdAt: daysAgo(400) },
	]);
	await db.insert(schema.organization).values([
		{ id: "o1", name: "One", slug: "one", createdAt: daysAgo(3) },
		{ id: "o2", name: "Two", slug: "two", createdAt: new Date() },
	]);
	await db.insert(schema.team).values({
		id: "t1",
		name: "Team",
		organizationId: "o1",
		createdAt: new Date(),
	});
	await db.insert(schema.session).values([
		{
			id: "s1",
			token: "t1",
			userId: "u1",
			expiresAt: daysAgo(-1),
			updatedAt: new Date(),
		},
		{
			id: "s2",
			token: "t2",
			userId: "u2",
			expiresAt: daysAgo(-1),
			updatedAt: new Date(),
			impersonatedBy: "u1",
		},
		{
			id: "s3",
			token: "t3",
			userId: "u3",
			expiresAt: daysAgo(1),
			updatedAt: new Date(),
		},
	]);
});

afterAll(async () => {
	await close();
});

describe("AdminService", () => {
	it("counts users, roles, orgs, teams and live sessions", async () => {
		await expect(service.getStats()).resolves.toEqual({
			users: 5,
			admins: 2,
			bannedUsers: 1,
			organizations: 2,
			teams: 1,
			activeSessions: 2,
			impersonatedSessions: 1,
		});
	});

	it("reports daily growth, zero-filling days without sign-ups", async () => {
		const growth = await service.getGrowth(7);

		expect(growth).toHaveLength(7);
		expect(growth.at(-1)).toEqual({
			date: isoDay(new Date()),
			users: 3,
			organizations: 1,
		});
		expect(growth.find(({ date }) => date === isoDay(daysAgo(3)))).toEqual({
			date: isoDay(daysAgo(3)),
			users: 1,
			organizations: 1,
		});
		expect(growth.reduce((sum, day) => sum + day.users, 0)).toBe(4);
	});
});

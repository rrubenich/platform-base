import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PERMISSIONS_KEY } from "../../auth/auth.decorators.js";
import { AuthGuard } from "../../auth/auth.guard.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";

// HTTP behavior of the routes — validation, status codes, which permission
// each requires — with the service mocked. The service itself is covered
// against a real database in organizations.service.spec.ts, and AuthGuard
// against the real admin plugin in lib/admin.spec.ts.
describe("OrganizationsController", () => {
	let app: INestApplication;
	const service = {
		list: vi.fn(),
		get: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		addMember: vi.fn(),
		updateMemberRole: vi.fn(),
		removeMember: vi.fn(),
		createTeam: vi.fn(),
		renameTeam: vi.fn(),
		removeTeam: vi.fn(),
		addTeamMember: vi.fn(),
		removeTeamMember: vi.fn(),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [OrganizationsController],
			providers: [{ provide: OrganizationsService, useValue: service }],
		})
			.overrideGuard(AuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = moduleRef.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		for (const fn of Object.values(service))
			fn.mockReset().mockResolvedValue({});
	});

	describe("GET /admin/organizations", () => {
		it("parses pagination from the query string, with defaults", async () => {
			await request(app.getHttpServer())
				.get("/admin/organizations?search=acme&limit=5")
				.expect(200);

			expect(service.list).toHaveBeenCalledWith(
				expect.objectContaining({ search: "acme", limit: 5, offset: 0 }),
			);
		});

		it("rejects an out-of-range limit", async () => {
			await request(app.getHttpServer())
				.get("/admin/organizations?limit=500")
				.expect(400);
			expect(service.list).not.toHaveBeenCalled();
		});
	});

	describe("POST /admin/organizations", () => {
		it("creates with a valid body", async () => {
			const body = { name: "Acme", slug: "acme-inc", ownerUserId: "u1" };

			await request(app.getHttpServer())
				.post("/admin/organizations")
				.send(body)
				.expect(201);

			expect(service.create).toHaveBeenCalledWith(body);
		});

		it.each([
			[{ name: "Acme", slug: "Not A Slug", ownerUserId: "u1" }],
			[{ name: "", slug: "acme", ownerUserId: "u1" }],
			[{ name: "Acme", slug: "acme" }],
			[{ name: "Acme", slug: "acme", ownerUserId: "u1", extra: true }],
		])("rejects %j", async (body) => {
			await request(app.getHttpServer())
				.post("/admin/organizations")
				.send(body)
				.expect(400);
			expect(service.create).not.toHaveBeenCalled();
		});
	});

	it("only accepts the organization plugin's roles", async () => {
		await request(app.getHttpServer())
			.patch("/admin/organizations/o1/members/m1")
			.send({ role: "superuser" })
			.expect(400);

		await request(app.getHttpServer())
			.patch("/admin/organizations/o1/members/m1")
			.send({ role: "admin" })
			.expect(200);
		expect(service.updateMemberRole).toHaveBeenCalledWith("o1", "m1", "admin");
	});

	it("answers a deleted organization with 204", async () => {
		await request(app.getHttpServer())
			.delete("/admin/organizations/o1")
			.expect(204);
		expect(service.remove).toHaveBeenCalledWith("o1");
	});

	it("routes team membership changes", async () => {
		await request(app.getHttpServer())
			.post("/admin/organizations/o1/teams/t1/members")
			.send({ userId: "u1" })
			.expect(201);
		await request(app.getHttpServer())
			.delete("/admin/organizations/o1/teams/t1/members/u1")
			.expect(200);

		expect(service.addTeamMember).toHaveBeenCalledWith("o1", "t1", "u1");
		expect(service.removeTeamMember).toHaveBeenCalledWith("o1", "t1", "u1");
	});

	it("guards every route with a specific permission", () => {
		const reflector = new Reflector();
		const proto = OrganizationsController.prototype;
		const handlers = Object.getOwnPropertyNames(proto).filter(
			(name) => name !== "constructor",
		) as (keyof OrganizationsController)[];

		expect(reflector.get("__guards__", OrganizationsController)).toEqual([
			AuthGuard,
		]);
		expect(
			Object.fromEntries(
				handlers.map((name) => [
					name,
					reflector.get(PERMISSIONS_KEY, proto[name]),
				]),
			),
		).toEqual({
			list: { organization: ["list"] },
			create: { organization: ["create"] },
			get: { organization: ["list"] },
			update: { organization: ["update"] },
			remove: { organization: ["delete"] },
			addMember: { "organization-member": ["create"] },
			updateMemberRole: { "organization-member": ["update"] },
			removeMember: { "organization-member": ["delete"] },
			createTeam: { team: ["create"] },
			renameTeam: { team: ["update"] },
			removeTeam: { team: ["delete"] },
			addTeamMember: { team: ["update"] },
			removeTeamMember: { team: ["update"] },
		});
	});
});

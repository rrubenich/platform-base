import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PERMISSIONS_KEY } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AccountInvitationsService } from "./account-invitations.service.js";
import { AdminAccountInvitationsController } from "./admin-account-invitations.controller.js";

// HTTP behavior with the service mocked (covered against a real database in
// account-invitations.service.spec.ts) and the guard replaced by a fixed
// signed-in superadmin.
describe("AdminAccountInvitationsController", () => {
	let app: INestApplication;
	const service = {
		create: vi.fn(),
		resend: vi.fn(),
		cancel: vi.fn(),
		forUsers: vi.fn(),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [AdminAccountInvitationsController],
			providers: [{ provide: AccountInvitationsService, useValue: service }],
		})
			.overrideGuard(AuthGuard)
			.useValue({
				canActivate: (context: ExecutionContext) => {
					context.switchToHttp().getRequest().session = {
						user: { id: "admin-1", name: "Sam Superadmin" },
					};
					return true;
				},
			})
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

	describe("POST /admin/account-invitations", () => {
		it("invites on behalf of the signed-in admin, in the request's locale", async () => {
			service.create.mockResolvedValue({
				id: "inv-1",
				organizationId: "org-1",
				userId: "user-1",
			});

			const response = await request(app.getHttpServer())
				.post("/admin/account-invitations")
				.set("Accept-Language", "pt-BR")
				.send({
					email: "jane@acme.com",
					organizationName: "Acme",
					slug: "acme",
				})
				.expect(201);

			expect(response.body).toEqual({
				id: "inv-1",
				organizationId: "org-1",
				userId: "user-1",
			});
			expect(service.create).toHaveBeenCalledWith(
				{ email: "jane@acme.com", organizationName: "Acme", slug: "acme" },
				{ id: "admin-1", name: "Sam Superadmin" },
				"pt-BR",
			);
		});

		it("rejects an invalid email or slug", async () => {
			await request(app.getHttpServer())
				.post("/admin/account-invitations")
				.send({ email: "nope", organizationName: "Acme", slug: "Acme Inc" })
				.expect(400);
			expect(service.create).not.toHaveBeenCalled();
		});
	});

	it("GET /admin/account-invitations splits the user ids", async () => {
		service.forUsers.mockResolvedValue([]);

		await request(app.getHttpServer())
			.get("/admin/account-invitations?userIds=u1,u2")
			.expect(200);

		expect(service.forUsers).toHaveBeenCalledWith(["u1", "u2"]);
	});

	it("GET /admin/account-invitations requires user ids", async () => {
		await request(app.getHttpServer())
			.get("/admin/account-invitations")
			.expect(400);
	});

	it("POST /admin/account-invitations/:id/resend resends as the admin", async () => {
		await request(app.getHttpServer())
			.post("/admin/account-invitations/inv-1/resend")
			.set("Accept-Language", "en")
			.expect(200);

		expect(service.resend).toHaveBeenCalledWith(
			"inv-1",
			"Sam Superadmin",
			"en",
		);
	});

	it("DELETE /admin/account-invitations/:id cancels it", async () => {
		await request(app.getHttpServer())
			.delete("/admin/account-invitations/inv-1")
			.expect(204);

		expect(service.cancel).toHaveBeenCalledWith("inv-1");
	});

	it("guards every route with the permissions it needs", () => {
		const reflector = new Reflector();
		const proto = AdminAccountInvitationsController.prototype;
		const handlers = Object.getOwnPropertyNames(proto).filter(
			(name) => name !== "constructor",
		) as (keyof AdminAccountInvitationsController)[];

		expect(
			reflector.get("__guards__", AdminAccountInvitationsController),
		).toEqual([AuthGuard]);
		expect(
			Object.fromEntries(
				handlers.map((name) => [
					name,
					reflector.get(PERMISSIONS_KEY, proto[name]),
				]),
			),
		).toEqual({
			create: { user: ["create"], organization: ["create"] },
			list: { user: ["list"] },
			resend: { user: ["create"] },
			cancel: { user: ["delete"], organization: ["delete"] },
		});
	});
});

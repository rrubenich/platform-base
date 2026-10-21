import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AccountInvitationsController } from "./account-invitations.controller.js";
import { AccountInvitationsService } from "./account-invitations.service.js";

// The public side: the token in the path is the credential, no session.
describe("AccountInvitationsController", () => {
	let app: INestApplication;
	const service = { preview: vi.fn(), accept: vi.fn() };

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [AccountInvitationsController],
			providers: [{ provide: AccountInvitationsService, useValue: service }],
		}).compile();

		app = moduleRef.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		for (const fn of Object.values(service)) fn.mockReset();
	});

	it("isn't behind a guard", () => {
		expect(
			new Reflector().get("__guards__", AccountInvitationsController),
		).toBeUndefined();
	});

	it("GET /account-invitations/:token previews it", async () => {
		service.preview.mockResolvedValue({
			email: "jane@acme.com",
			organizationName: "Acme",
		});

		const response = await request(app.getHttpServer())
			.get("/account-invitations/tok-1")
			.expect(200);

		expect(response.body).toEqual({
			email: "jane@acme.com",
			organizationName: "Acme",
		});
		expect(service.preview).toHaveBeenCalledWith("tok-1");
	});

	it("POST /account-invitations/:token/accept sets up the account", async () => {
		service.accept.mockResolvedValue({ email: "jane@acme.com" });

		await request(app.getHttpServer())
			.post("/account-invitations/tok-1/accept")
			.send({ name: "Jane", password: "s3cret-pass" })
			.expect(200, { email: "jane@acme.com" });

		expect(service.accept).toHaveBeenCalledWith("tok-1", {
			name: "Jane",
			password: "s3cret-pass",
		});
	});

	it("rejects a short password before reaching the service", async () => {
		await request(app.getHttpServer())
			.post("/account-invitations/tok-1/accept")
			.send({ name: "Jane", password: "short" })
			.expect(400);
		expect(service.accept).not.toHaveBeenCalled();
	});
});

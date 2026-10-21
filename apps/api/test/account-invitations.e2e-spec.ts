import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "./../src/app.module.js";

describe("Account invitations (e2e)", () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	it("/admin/account-invitations (POST) requires a session", () => {
		return request(app.getHttpServer())
			.post("/admin/account-invitations")
			.send({ email: "jane@acme.com", organizationName: "Acme", slug: "acme" })
			.expect(401);
	});

	it("/account-invitations/:token (GET) is public and 404s an unknown token", () => {
		return request(app.getHttpServer())
			.get("/account-invitations/not-a-real-token")
			.expect(404);
	});

	afterEach(async () => {
		await app.close();
	});
});

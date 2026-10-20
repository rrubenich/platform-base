import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "./../src/app.module.js";

describe("AdminController (e2e)", () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	it("/admin/stats (GET) requires a session", () => {
		return request(app.getHttpServer()).get("/admin/stats").expect(401);
	});

	it("/admin/stats (GET) rejects an unknown session cookie", () => {
		return request(app.getHttpServer())
			.get("/admin/stats")
			.set("Cookie", "better-auth.session_token=not-a-real-token")
			.expect(401);
	});

	it("/admin/organizations (GET) requires a session", () => {
		return request(app.getHttpServer()).get("/admin/organizations").expect(401);
	});

	afterEach(async () => {
		await app.close();
	});
});

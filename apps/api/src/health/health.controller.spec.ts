import { Test, type TestingModule } from "@nestjs/testing";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import { REDIS_CONNECTION } from "../redis/redis.module.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
	let controller: HealthController;
	const db = { execute: vi.fn() };
	const redis = { ping: vi.fn() };

	beforeEach(async () => {
		db.execute.mockReset();
		redis.ping.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [HealthController],
			providers: [
				{ provide: DATABASE_CONNECTION, useValue: db },
				{ provide: REDIS_CONNECTION, useValue: redis },
			],
		}).compile();

		controller = module.get(HealthController);
	});

	it("returns ok once the database query succeeds", async () => {
		db.execute.mockResolvedValue(undefined);

		await expect(controller.checkDatabase()).resolves.toEqual({ status: "ok" });
		expect(db.execute).toHaveBeenCalledTimes(1);
	});

	it("propagates the error when the database query fails", async () => {
		db.execute.mockRejectedValue(new Error("connection refused"));

		await expect(controller.checkDatabase()).rejects.toThrow(
			"connection refused",
		);
	});

	it("returns ok once redis responds to ping", async () => {
		redis.ping.mockResolvedValue("PONG");

		await expect(controller.checkRedis()).resolves.toEqual({ status: "ok" });
		expect(redis.ping).toHaveBeenCalledTimes(1);
	});

	it("propagates the error when redis is unreachable", async () => {
		redis.ping.mockRejectedValue(new Error("connection refused"));

		await expect(controller.checkRedis()).rejects.toThrow("connection refused");
	});
});

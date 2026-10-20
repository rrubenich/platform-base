import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { AUTH_INSTANCE } from "../auth/auth.constants.js";
import { PERMISSIONS_KEY } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

describe("AdminController", () => {
	let controller: AdminController;
	const adminService = { getStats: vi.fn() };

	beforeEach(async () => {
		adminService.getStats.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AdminController],
			providers: [
				{ provide: AdminService, useValue: adminService },
				{ provide: AUTH_INSTANCE, useValue: {} },
				AuthGuard,
			],
		}).compile();

		controller = module.get(AdminController);
	});

	it("returns the platform stats", async () => {
		const stats = {
			users: 3,
			admins: 1,
			bannedUsers: 0,
			organizations: 2,
			activeSessions: 4,
			impersonatedSessions: 1,
		};
		adminService.getStats.mockResolvedValue(stats);

		await expect(controller.getStats()).resolves.toEqual(stats);
	});

	// AuthGuard's behavior is covered against the real admin plugin in
	// lib/admin.spec.ts; this only pins what the route asks it to enforce.
	it("guards every route and restricts stats to user and session listing", () => {
		const reflector = new Reflector();

		expect(reflector.get("__guards__", AdminController)).toEqual([AuthGuard]);
		expect(reflector.get(PERMISSIONS_KEY, controller.getStats)).toEqual({
			user: ["list"],
			session: ["list"],
		});
	});
});

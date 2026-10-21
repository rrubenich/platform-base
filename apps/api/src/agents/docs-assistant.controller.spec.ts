import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Response } from "express";
import { AUTH_INSTANCE } from "../auth/auth.constants.js";
import { PERMISSIONS_KEY } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { Session } from "../lib/auth.js";
import { AgentsService } from "./agents.service.js";
import { DocsAssistantController } from "./docs-assistant.controller.js";

describe("DocsAssistantController", () => {
	let controller: DocsAssistantController;
	const agents = { chat: vi.fn(), thread: vi.fn() };

	beforeEach(async () => {
		agents.chat.mockReset();
		agents.thread.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [DocsAssistantController],
			providers: [
				{ provide: AgentsService, useValue: agents },
				{ provide: AUTH_INSTANCE, useValue: {} },
				AuthGuard,
			],
		}).compile();

		controller = module.get(DocsAssistantController);
	});

	// AuthGuard enforces it (see lib/admin.spec.ts); this pins what it asks.
	it("is only for roles allowed to use the docs assistant", () => {
		const reflector = new Reflector();

		expect(reflector.get("__guards__", DocsAssistantController)).toEqual([
			AuthGuard,
		]);
		for (const route of [controller.chat, controller.thread]) {
			expect(reflector.get(PERMISSIONS_KEY, route)).toEqual({
				"docs-assistant": ["use"],
			});
		}
	});

	it("streams the docs agent's reply for the signed-in admin", async () => {
		agents.chat.mockResolvedValue(new Response("event: done\n\n"));
		const written: string[] = [];
		const response = {
			on: vi.fn(),
			status: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			flushHeaders: vi.fn(),
			end: vi.fn(),
			write: vi.fn((chunk: Buffer) => written.push(chunk.toString())),
			once: vi.fn(),
			emit: vi.fn(),
			removeListener: vi.fn(),
		};
		const body = { message: "Oi", threadId: "t1" };

		await controller.chat(
			{ user: { id: "admin-1" } } as Session,
			body,
			response as unknown as Response,
		);

		expect(agents.chat).toHaveBeenCalledWith(
			"docs",
			{ userId: "admin-1" },
			{ message: "Oi", thread_id: "t1" },
			expect.any(AbortSignal),
		);
		expect(response.set).toHaveBeenCalledWith(
			expect.objectContaining({ "Content-Type": "text/event-stream" }),
		);
	});

	it("reads the signed-in admin's own conversation", async () => {
		const thread = { id: "t1", messages: [] };
		agents.thread.mockResolvedValue(thread);

		await expect(
			controller.thread({ user: { id: "admin-1" } } as Session, "t1"),
		).resolves.toBe(thread);
		expect(agents.thread).toHaveBeenCalledWith(
			"docs",
			{ userId: "admin-1" },
			"t1",
		);
	});
});

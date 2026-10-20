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
	const agents = { docsChat: vi.fn() };

	beforeEach(async () => {
		agents.docsChat.mockReset();

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
		expect(reflector.get(PERMISSIONS_KEY, controller.chat)).toEqual({
			"docs-assistant": ["use"],
		});
	});

	it("streams the docs agent's reply for the signed-in admin", async () => {
		agents.docsChat.mockResolvedValue(new Response("event: done\n\n"));
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
		const body = { messages: [{ role: "user" as const, content: "Oi" }] };

		await controller.chat(
			{ user: { id: "admin-1" } } as Session,
			body,
			response as unknown as Response,
		);

		expect(agents.docsChat).toHaveBeenCalledWith(
			"admin-1",
			body,
			expect.any(AbortSignal),
		);
		expect(response.set).toHaveBeenCalledWith(
			expect.objectContaining({ "Content-Type": "text/event-stream" }),
		);
	});
});

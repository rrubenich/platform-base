import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { AUTH_INSTANCE } from "../auth/auth.constants.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { Session } from "../lib/auth.js";
import { AgentsController } from "./agents.controller.js";
import { AgentsService } from "./agents.service.js";

describe("AgentsController", () => {
	let controller: AgentsController;
	const caller = { userId: "user-1", organizationId: "org-1" };
	const session = {} as Session;
	const agents = {
		callerFor: vi.fn(),
		createJob: vi.fn(),
		getJob: vi.fn(),
		thread: vi.fn(),
	};

	beforeEach(async () => {
		for (const mock of Object.values(agents)) mock.mockReset();
		agents.callerFor.mockResolvedValue(caller);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AgentsController],
			providers: [
				{ provide: AgentsService, useValue: agents },
				{ provide: AUTH_INSTANCE, useValue: {} },
				AuthGuard,
			],
		}).compile();

		controller = module.get(AgentsController);
	});

	it("needs a session on every route", () => {
		expect(new Reflector().get("__guards__", AgentsController)).toEqual([
			AuthGuard,
		]);
	});

	it("queues a job for the session's organization", async () => {
		agents.createJob.mockResolvedValue({ id: "job-1" });

		await expect(
			controller.createJob(session, { prompt: "Resuma" }),
		).resolves.toEqual({ id: "job-1" });
		expect(agents.callerFor).toHaveBeenCalledWith(session);
		expect(agents.createJob).toHaveBeenCalledWith("assistant", caller, {
			prompt: "Resuma",
		});
	});

	it("looks a job up within the session's organization", async () => {
		const job = { id: "job-1", agent: "assistant", status: "queued" };
		agents.getJob.mockResolvedValue(job);

		await expect(controller.getJob(session, "job-1")).resolves.toEqual(job);
		expect(agents.getJob).toHaveBeenCalledWith("assistant", caller, "job-1");
	});

	it("reads the caller's own conversation with the assistant", async () => {
		const thread = { id: "t1", messages: [] };
		agents.thread.mockResolvedValue(thread);

		await expect(controller.thread(session, "t1")).resolves.toBe(thread);
		expect(agents.thread).toHaveBeenCalledWith("assistant", caller, "t1");
	});

	it("doesn't reach the agents service when the caller check fails", async () => {
		agents.callerFor.mockRejectedValue(new Error("forbidden"));

		await expect(controller.getJob(session, "job-1")).rejects.toThrow(
			"forbidden",
		);
		expect(agents.getJob).not.toHaveBeenCalled();
	});
});

import {
	BadGatewayException,
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import type { Session } from "../lib/auth.js";
import { AgentsService } from "./agents.service.js";

const CALLER = { userId: "user-1", organizationId: "org-1" };

function sessionWith(activeOrganizationId: string | null): Session {
	return {
		user: { id: "user-1" },
		session: { activeOrganizationId },
	} as unknown as Session;
}

describe("AgentsService", () => {
	let service: AgentsService;
	const memberships: { id: string }[] = [];
	const limit = vi.fn(async () => memberships);
	const db = {
		select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
	};
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(async () => {
		memberships.length = 0;
		limit.mockClear();
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AgentsService,
				{ provide: DATABASE_CONNECTION, useValue: db },
				{
					provide: ConfigService,
					useValue: new ConfigService({
						AGENTS_URL: "http://agents.internal",
						AGENTS_SERVICE_TOKEN: "secret",
					}),
				},
			],
		}).compile();

		service = module.get(AgentsService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("callerFor", () => {
		it("returns the user and their active organization when they are a member", async () => {
			memberships.push({ id: "member-1" });

			await expect(service.callerFor(sessionWith("org-1"))).resolves.toEqual(
				CALLER,
			);
		});

		it("refuses a session without an active organization", async () => {
			await expect(service.callerFor(sessionWith(null))).rejects.toThrow(
				ForbiddenException,
			);
			expect(limit).not.toHaveBeenCalled();
		});

		it("refuses a user who is no longer a member of the active organization", async () => {
			await expect(service.callerFor(sessionWith("org-1"))).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	it("sends the service token and the caller on every request", async () => {
		fetchMock.mockResolvedValue(
			Response.json({ id: "job-1" }, { status: 202 }),
		);

		await expect(
			service.createJob(CALLER, { prompt: "Resuma" }),
		).resolves.toEqual({ id: "job-1" });

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://agents.internal/v1/assistant/jobs");
		expect(init?.headers).toMatchObject({
			"X-Service-Token": "secret",
			"X-User-Id": "user-1",
			"X-Organization-Id": "org-1",
		});
		expect(init?.body).toBe(JSON.stringify({ prompt: "Resuma" }));
	});

	it("maps a missing job to 404", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		await expect(service.getJob(CALLER, "job-1")).rejects.toThrow(
			NotFoundException,
		);
	});

	it("maps other upstream failures to 502", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

		await expect(service.getJob(CALLER, "job-1")).rejects.toThrow(
			BadGatewayException,
		);
	});

	it("maps an unreachable service to 503", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(service.health()).rejects.toThrow(ServiceUnavailableException);
	});
});

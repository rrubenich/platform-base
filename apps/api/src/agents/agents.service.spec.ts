import {
	BadGatewayException,
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { type CryptoKey, exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import type { Session } from "../lib/auth.js";
import {
	AGENTS_JWT_AUDIENCE,
	AGENTS_JWT_ISSUER,
	AgentsService,
} from "./agents.service.js";

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
	let publicKey: CryptoKey;
	let privateKeyPem: string;

	beforeAll(async () => {
		const keys = await generateKeyPair("EdDSA", { extractable: true });
		publicKey = keys.publicKey;
		privateKeyPem = await exportPKCS8(keys.privateKey);
	});

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
						AGENTS_JWT_PRIVATE_KEY: privateKeyPem,
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

	it("sends a short-lived token, signed for the agents service, naming the caller", async () => {
		fetchMock.mockResolvedValue(
			Response.json({ id: "job-1" }, { status: 202 }),
		);

		await expect(
			service.createJob("assistant", CALLER, { prompt: "Resuma" }),
		).resolves.toEqual({ id: "job-1" });

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://agents.internal/v1/agents/assistant/jobs");
		expect(init?.body).toBe(JSON.stringify({ prompt: "Resuma" }));

		const headers = (init?.headers ?? {}) as Record<string, string>;
		const authorization = headers.Authorization;
		expect(authorization).toMatch(/^Bearer /);
		const { payload, protectedHeader } = await jwtVerify(
			authorization.slice("Bearer ".length),
			publicKey,
			{ issuer: AGENTS_JWT_ISSUER, audience: AGENTS_JWT_AUDIENCE },
		);
		expect(protectedHeader.alg).toBe("EdDSA");
		expect(payload).toMatchObject({
			sub: "user-1",
			org: "org-1",
			scope: "assistant",
		});
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60);
	});

	it("scopes the docs assistant's token to it, without an organization", async () => {
		fetchMock.mockResolvedValue(new Response("event: done\n\n"));

		await service.chat(
			"docs",
			{ userId: "admin-1" },
			{ message: "Como funciona o JWT?", thread_id: null },
			new AbortController().signal,
		);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://agents.internal/v1/agents/docs/chat");
		const headers = (init?.headers ?? {}) as Record<string, string>;
		const { payload } = await jwtVerify(
			headers.Authorization.slice("Bearer ".length),
			publicKey,
			{ issuer: AGENTS_JWT_ISSUER, audience: AGENTS_JWT_AUDIENCE },
		);
		expect(payload.sub).toBe("admin-1");
		expect(payload.scope).toBe("docs");
		expect(payload).not.toHaveProperty("org");
	});

	it("reads a thread, escaping its id in the path", async () => {
		const thread = { id: "a b", messages: [] };
		fetchMock.mockResolvedValue(Response.json(thread));

		await expect(service.thread("assistant", CALLER, "a b")).resolves.toEqual(
			thread,
		);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"http://agents.internal/v1/agents/assistant/threads/a%20b",
		);
	});

	it("calls the health check without a token", async () => {
		fetchMock.mockResolvedValue(Response.json({ status: "ok" }));

		await expect(service.health()).resolves.toEqual({ status: "ok" });
		expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty(
			"Authorization",
		);
	});

	it("maps a missing job to 404", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		await expect(service.getJob("assistant", CALLER, "job-1")).rejects.toThrow(
			NotFoundException,
		);
	});

	it("maps other upstream failures to 502", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

		await expect(service.getJob("assistant", CALLER, "job-1")).rejects.toThrow(
			BadGatewayException,
		);
	});

	it("maps an unreachable service to 503", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(service.health()).rejects.toThrow(ServiceUnavailableException);
	});
});

import {
	BadGatewayException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import { member } from "../database/schema.js";
import type { Session } from "../lib/auth.js";
import type { components } from "./agents-api.gen.js";

type Schemas = components["schemas"];
export type ChatRequest = Schemas["ChatRequest"];
export type JobRequest = Schemas["JobRequest"];
export type JobCreated = Schemas["JobCreated"];
export type JobView = Schemas["JobView"];

/** Who apps/agents is told is calling. It trusts this, so it must be checked. */
export type AgentCaller = { userId: string; organizationId: string };

/**
 * Client for the internal Python agents service (apps/agents). Every call
 * carries the shared service token and the caller's user and organization;
 * the agents service never sees the user's session itself.
 */
@Injectable()
export class AgentsService {
	constructor(
		private readonly config: ConfigService,
		@Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase,
	) {}

	/**
	 * The session's active organization, provided the user is still a member
	 * of it: membership can end while a session still points at the org.
	 */
	async callerFor(session: Session): Promise<AgentCaller> {
		// Added by the organization plugin, which the generic `Session` type
		// erases (see lib/auth.ts), like `role` in auth.guard.ts.
		const { activeOrganizationId: organizationId } = session.session as {
			activeOrganizationId?: string | null;
		};
		if (!organizationId) {
			throw new ForbiddenException("No active organization");
		}
		const [membership] = await this.db
			.select({ id: member.id })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, session.user.id),
				),
			)
			.limit(1);
		if (!membership) {
			throw new ForbiddenException("Not a member of the active organization");
		}
		return { userId: session.user.id, organizationId };
	}

	async health(): Promise<{ status: "ok" }> {
		const response = await this.send("/health", { method: "GET" });
		return (await response.json()) as { status: "ok" };
	}

	/** The upstream SSE response, unread, for the controller to pipe through. */
	chat(
		caller: AgentCaller,
		body: ChatRequest,
		signal: AbortSignal,
	): Promise<Response> {
		return this.send(
			"/v1/assistant/chat",
			{ method: "POST", body: JSON.stringify(body), signal },
			caller,
		);
	}

	async createJob(caller: AgentCaller, body: JobRequest): Promise<JobCreated> {
		const response = await this.send(
			"/v1/assistant/jobs",
			{ method: "POST", body: JSON.stringify(body) },
			caller,
		);
		return (await response.json()) as JobCreated;
	}

	async getJob(caller: AgentCaller, jobId: string): Promise<JobView> {
		const response = await this.send(
			`/v1/assistant/jobs/${encodeURIComponent(jobId)}`,
			{ method: "GET" },
			caller,
		);
		return (await response.json()) as JobView;
	}

	private async send(
		path: string,
		init: RequestInit,
		caller?: AgentCaller,
	): Promise<Response> {
		// Read per call, not at boot, so the API still starts (and its e2e
		// suite runs) on machines that don't run the agents service.
		const baseUrl =
			this.config.get<string>("AGENTS_URL") ?? "http://localhost:8000";
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-Service-Token": this.config.getOrThrow<string>("AGENTS_SERVICE_TOKEN"),
		};
		if (caller) {
			headers["X-User-Id"] = caller.userId;
			headers["X-Organization-Id"] = caller.organizationId;
		}

		let response: Response;
		try {
			response = await fetch(`${baseUrl}${path}`, { ...init, headers });
		} catch (error) {
			if (init.signal?.aborted) throw error;
			throw new ServiceUnavailableException("Agents service is unreachable");
		}
		if (response.status === 404) throw new NotFoundException();
		// Anything else non-2xx is a bug between the two services (bad token,
		// a request the agents service rejects), not something the user did.
		if (!response.ok) {
			throw new BadGatewayException(
				`Agents service responded ${response.status}`,
			);
		}
		return response;
	}
}

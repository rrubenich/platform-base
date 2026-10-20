import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import { AgentsService } from "../agents/agents.service.js";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import { REDIS_CONNECTION } from "../redis/redis.module.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: NodePgDatabase,
		@Inject(REDIS_CONNECTION)
		private readonly redis: Redis,
		private readonly agents: AgentsService,
	) {}

	@Get("db")
	@ApiOperation({ summary: "Check connectivity to the Postgres database" })
	async checkDatabase(): Promise<{ status: "ok" }> {
		await this.db.execute(sql`select 1`);
		return { status: "ok" };
	}

	@Get("redis")
	@ApiOperation({ summary: "Check connectivity to Redis" })
	async checkRedis(): Promise<{ status: "ok" }> {
		await this.redis.ping();
		return { status: "ok" };
	}

	@Get("agents")
	@ApiOperation({ summary: "Check that the internal agents service is up" })
	checkAgents(): Promise<{ status: "ok" }> {
		return this.agents.health();
	}
}

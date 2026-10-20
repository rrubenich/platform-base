import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { HealthController } from "./health.controller.js";

@Module({
	imports: [AgentsModule, DatabaseModule, RedisModule],
	controllers: [HealthController],
})
export class HealthModule {}

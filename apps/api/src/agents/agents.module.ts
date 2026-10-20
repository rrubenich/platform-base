import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AgentsController } from "./agents.controller.js";
import { AgentsService } from "./agents.service.js";
import { DocsAssistantController } from "./docs-assistant.controller.js";

@Module({
	imports: [DatabaseModule],
	controllers: [AgentsController, DocsAssistantController],
	providers: [AgentsService],
	exports: [AgentsService],
})
export class AgentsModule {}

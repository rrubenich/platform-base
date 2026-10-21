import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountInvitationsModule } from "./account-invitations/account-invitations.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AgentsModule } from "./agents/agents.module.js";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		AuthModule,
		DatabaseModule,
		HealthModule,
		AdminModule,
		AccountInvitationsModule,
		AgentsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}

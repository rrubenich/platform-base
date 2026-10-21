import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AccountInvitationsController } from "./account-invitations.controller.js";
import { AccountInvitationsService } from "./account-invitations.service.js";
import { AdminAccountInvitationsController } from "./admin-account-invitations.controller.js";

@Module({
	imports: [DatabaseModule],
	controllers: [
		AdminAccountInvitationsController,
		AccountInvitationsController,
	],
	providers: [AccountInvitationsService],
})
export class AccountInvitationsModule {}

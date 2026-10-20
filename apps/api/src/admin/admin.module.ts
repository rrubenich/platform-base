import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { OrganizationsController } from "./organizations/organizations.controller.js";
import { OrganizationsService } from "./organizations/organizations.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [AdminController, OrganizationsController],
	providers: [AdminService, OrganizationsService],
})
export class AdminModule {}

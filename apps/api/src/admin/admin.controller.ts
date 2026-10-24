import {
	Controller,
	DefaultValuePipe,
	Get,
	ParseIntPipe,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiCookieAuth,
	ApiForbiddenResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import {
	AdminService,
	type AdminStats,
	type GrowthPoint,
} from "./admin.service.js";

const MAX_GROWTH_DAYS = 365;

// User management itself (list, ban, set-role, impersonate…) is served by
// Better Auth's admin plugin under /api/auth/admin/*; this controller holds
// the admin-only routes that plugin doesn't cover.
@ApiTags("admin")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "Not signed in" })
@ApiForbiddenResponse({ description: "Role lacks the required permission" })
@UseGuards(AuthGuard)
@Controller("admin")
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Get("stats")
	@RequirePermissions({ user: ["list"], session: ["list"] })
	@ApiOperation({
		summary: "Platform-wide user, organization and session counts",
	})
	getStats(): Promise<AdminStats> {
		return this.adminService.getStats();
	}

	@Get("stats/growth")
	@RequirePermissions({ user: ["list"] })
	@ApiOperation({ summary: "New users and organizations per day" })
	@ApiQuery({ name: "days", required: false, schema: { default: 90 } })
	getGrowth(
		@Query("days", new DefaultValuePipe(90), ParseIntPipe) days: number,
	): Promise<GrowthPoint[]> {
		return this.adminService.getGrowth(
			Math.min(Math.max(days, 1), MAX_GROWTH_DAYS),
		);
	}
}

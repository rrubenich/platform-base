import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCookieAuth,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { RequirePermissions } from "../../auth/auth.decorators.js";
import { AuthGuard } from "../../auth/auth.guard.js";
import {
	AddMemberBody,
	AddTeamMemberBody,
	CreateOrganizationBody,
	ListOrganizationsQuery,
	TeamBody,
	UpdateMemberRoleBody,
	UpdateOrganizationBody,
} from "./organizations.dto.js";
import {
	type OrganizationDetail,
	type OrganizationSummary,
	OrganizationsService,
} from "./organizations.service.js";

// Superadmin management of every organization. Mutations return the updated
// organization so the admin UI can refresh from the response.
@ApiTags("admin")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "Not signed in" })
@ApiForbiddenResponse({ description: "Role lacks the required permission" })
@ApiBadRequestResponse({ description: "Invalid input" })
@UseGuards(AuthGuard)
@UsePipes(
	new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
	}),
)
@Controller("admin/organizations")
export class OrganizationsController {
	constructor(private readonly organizations: OrganizationsService) {}

	@Get()
	@RequirePermissions({ organization: ["list"] })
	@ApiOperation({ summary: "List every organization" })
	list(@Query() query: ListOrganizationsQuery): Promise<{
		organizations: OrganizationSummary[];
		total: number;
	}> {
		return this.organizations.list(query);
	}

	@Post()
	@RequirePermissions({ organization: ["create"] })
	@ApiOperation({ summary: "Create an organization owned by a user" })
	@ApiNotFoundResponse({ description: "Owner not found" })
	create(@Body() body: CreateOrganizationBody): Promise<OrganizationDetail> {
		return this.organizations.create(body);
	}

	@Get(":id")
	@RequirePermissions({ organization: ["list"] })
	@ApiOperation({
		summary: "An organization with its members, teams and invitations",
	})
	@ApiNotFoundResponse()
	get(@Param("id") id: string): Promise<OrganizationDetail> {
		return this.organizations.get(id);
	}

	@Patch(":id")
	@RequirePermissions({ organization: ["update"] })
	@ApiOperation({ summary: "Rename an organization or change its slug" })
	@ApiNotFoundResponse()
	@ApiConflictResponse({ description: "Slug is already taken" })
	update(
		@Param("id") id: string,
		@Body() body: UpdateOrganizationBody,
	): Promise<OrganizationDetail> {
		return this.organizations.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	@RequirePermissions({ organization: ["delete"] })
	@ApiOperation({
		summary: "Delete an organization with its members, teams and invitations",
	})
	@ApiNotFoundResponse()
	remove(@Param("id") id: string): Promise<void> {
		return this.organizations.remove(id);
	}

	@Post(":id/members")
	@RequirePermissions({ "organization-member": ["create"] })
	@ApiOperation({ summary: "Add an existing user to an organization" })
	@ApiNotFoundResponse({ description: "Organization or user not found" })
	@ApiConflictResponse({ description: "Already a member" })
	addMember(
		@Param("id") id: string,
		@Body() body: AddMemberBody,
	): Promise<OrganizationDetail> {
		return this.organizations.addMember(id, body);
	}

	@Patch(":id/members/:memberId")
	@RequirePermissions({ "organization-member": ["update"] })
	@ApiOperation({ summary: "Change a member's role" })
	@ApiNotFoundResponse()
	updateMemberRole(
		@Param("id") id: string,
		@Param("memberId") memberId: string,
		@Body() { role }: UpdateMemberRoleBody,
	): Promise<OrganizationDetail> {
		return this.organizations.updateMemberRole(id, memberId, role);
	}

	@Delete(":id/members/:memberId")
	@RequirePermissions({ "organization-member": ["delete"] })
	@ApiOperation({ summary: "Remove a member (and their team memberships)" })
	@ApiNotFoundResponse()
	removeMember(
		@Param("id") id: string,
		@Param("memberId") memberId: string,
	): Promise<OrganizationDetail> {
		return this.organizations.removeMember(id, memberId);
	}

	@Post(":id/teams")
	@RequirePermissions({ team: ["create"] })
	@ApiOperation({ summary: "Create a team" })
	@ApiNotFoundResponse()
	createTeam(
		@Param("id") id: string,
		@Body() { name }: TeamBody,
	): Promise<OrganizationDetail> {
		return this.organizations.createTeam(id, name);
	}

	@Patch(":id/teams/:teamId")
	@RequirePermissions({ team: ["update"] })
	@ApiOperation({ summary: "Rename a team" })
	@ApiNotFoundResponse()
	renameTeam(
		@Param("id") id: string,
		@Param("teamId") teamId: string,
		@Body() { name }: TeamBody,
	): Promise<OrganizationDetail> {
		return this.organizations.renameTeam(id, teamId, name);
	}

	@Delete(":id/teams/:teamId")
	@RequirePermissions({ team: ["delete"] })
	@ApiOperation({ summary: "Delete a team" })
	@ApiNotFoundResponse()
	removeTeam(
		@Param("id") id: string,
		@Param("teamId") teamId: string,
	): Promise<OrganizationDetail> {
		return this.organizations.removeTeam(id, teamId);
	}

	@Post(":id/teams/:teamId/members")
	@RequirePermissions({ team: ["update"] })
	@ApiOperation({ summary: "Add an organization member to a team" })
	@ApiNotFoundResponse()
	@ApiConflictResponse({ description: "Already in the team" })
	addTeamMember(
		@Param("id") id: string,
		@Param("teamId") teamId: string,
		@Body() { userId }: AddTeamMemberBody,
	): Promise<OrganizationDetail> {
		return this.organizations.addTeamMember(id, teamId, userId);
	}

	@Delete(":id/teams/:teamId/members/:userId")
	@RequirePermissions({ team: ["update"] })
	@ApiOperation({ summary: "Remove a user from a team" })
	@ApiNotFoundResponse()
	removeTeamMember(
		@Param("id") id: string,
		@Param("teamId") teamId: string,
		@Param("userId") userId: string,
	): Promise<OrganizationDetail> {
		return this.organizations.removeTeamMember(id, teamId, userId);
	}
}

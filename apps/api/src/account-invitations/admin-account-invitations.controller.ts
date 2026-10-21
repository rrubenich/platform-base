import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpCode,
	Param,
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
import { CurrentSession, RequirePermissions } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { requestLocale } from "../i18n/i18n.js";
import type { Session } from "../lib/auth.js";
import {
	AccountInvitationsQuery,
	CreateAccountInvitationBody,
} from "./account-invitations.dto.js";
import {
	AccountInvitationsService,
	type OwnerSetup,
} from "./account-invitations.service.js";

type RequestHeaders = Record<string, string | undefined>;

// Superadmins create accounts: the user, a new organization they own, and
// the emailed link where they set their login.
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
@Controller("admin/account-invitations")
export class AdminAccountInvitationsController {
	constructor(private readonly invitations: AccountInvitationsService) {}

	@Post()
	@RequirePermissions({ user: ["create"], organization: ["create"] })
	@ApiOperation({
		summary: "Create an account and its organization, and email the link",
	})
	@ApiConflictResponse({ description: "EMAIL_TAKEN or SLUG_TAKEN" })
	create(
		@Body() body: CreateAccountInvitationBody,
		@CurrentSession() session: Session,
		@Headers() headers: RequestHeaders,
	): Promise<{ id: string; organizationId: string; userId: string }> {
		return this.invitations.create(
			body,
			{ id: session.user.id, name: session.user.name },
			requestLocale(headers),
		);
	}

	@Get()
	@RequirePermissions({ user: ["list"] })
	@ApiOperation({ summary: "Unfinished account setups of these users" })
	list(
		@Query() query: AccountInvitationsQuery,
	): Promise<(OwnerSetup & { userId: string })[]> {
		return this.invitations.forUsers(query.userIds);
	}

	@Post(":id/resend")
	@HttpCode(200)
	@RequirePermissions({ user: ["create"] })
	@ApiOperation({ summary: "Email a new link, valid for another 7 days" })
	@ApiNotFoundResponse({ description: "Invitation not found" })
	@ApiConflictResponse({ description: "ALREADY_ACCEPTED" })
	resend(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Headers() headers: RequestHeaders,
	): Promise<OwnerSetup> {
		return this.invitations.resend(
			id,
			session.user.name,
			requestLocale(headers),
		);
	}

	@Delete(":id")
	@HttpCode(204)
	@RequirePermissions({ user: ["delete"], organization: ["delete"] })
	@ApiOperation({
		summary:
			"Cancel a pending invitation: deletes the account and organization",
	})
	@ApiNotFoundResponse({ description: "Invitation not found" })
	@ApiConflictResponse({ description: "ALREADY_ACCEPTED" })
	cancel(@Param("id") id: string): Promise<void> {
		return this.invitations.cancel(id);
	}
}

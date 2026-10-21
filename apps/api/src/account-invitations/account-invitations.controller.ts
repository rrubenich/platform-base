import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	Post,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiGoneResponse,
	ApiNotFoundResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { AcceptAccountInvitationBody } from "./account-invitations.dto.js";
import { AccountInvitationsService } from "./account-invitations.service.js";

// Public: the token in the path is the credential (256 random bits, only
// ever sent in the invitation email).
@ApiTags("account-invitations")
@ApiNotFoundResponse({ description: "Unknown token" })
@ApiGoneResponse({ description: "INVITATION_EXPIRED or INVITATION_ACCEPTED" })
@UsePipes(
	new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
	}),
)
@Controller("account-invitations")
export class AccountInvitationsController {
	constructor(private readonly invitations: AccountInvitationsService) {}

	@Get(":token")
	@ApiOperation({
		summary: "Who the invitation is for, and which organization",
	})
	preview(
		@Param("token") token: string,
	): Promise<{ email: string; organizationName: string }> {
		return this.invitations.preview(token);
	}

	@Post(":token/accept")
	@HttpCode(200)
	@ApiOperation({ summary: "Set name and password; verifies the email" })
	@ApiBadRequestResponse({ description: "Invalid name or password" })
	accept(
		@Param("token") token: string,
		@Body() body: AcceptAccountInvitationBody,
	): Promise<{ email: string }> {
		return this.invitations.accept(token, body);
	}
}

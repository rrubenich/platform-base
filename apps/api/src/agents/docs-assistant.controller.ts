import {
	Body,
	Controller,
	Post,
	Res,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiCookieAuth,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentSession, RequirePermissions } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { Session } from "../lib/auth.js";
import { AGENT_CHAT_EVENTS, ChatDto } from "./agents.dto.js";
import { AgentsService } from "./agents.service.js";
import { proxyEventStream } from "./event-stream.js";

// The admin console's docs assistant: explains how Platform Base is built, answering
// from the repository's docs (apps/agents/src/agents_service/agents/docs/).
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
@Controller("admin/docs-assistant")
export class DocsAssistantController {
	constructor(private readonly agents: AgentsService) {}

	@Post("chat")
	@RequirePermissions({ "docs-assistant": ["use"] })
	@ApiOperation({
		summary: "Ask how Platform Base is built, streamed as server-sent events",
		description: AGENT_CHAT_EVENTS,
	})
	@ApiOkResponse({ content: { "text/event-stream": {} } })
	async chat(
		@CurrentSession() session: Session,
		@Body() body: ChatDto,
		@Res() response: Response,
	): Promise<void> {
		await proxyEventStream(response, (signal) =>
			this.agents.docsChat(session.user.id, body, signal),
		);
	}
}

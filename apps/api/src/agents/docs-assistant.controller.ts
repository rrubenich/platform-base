import {
	Body,
	Controller,
	Get,
	Param,
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
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentSession, RequirePermissions } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { Session } from "../lib/auth.js";
import {
	AGENT_CHAT_EVENTS,
	ChatDto,
	ThreadIdPipe,
	toChatRequest,
} from "./agents.dto.js";
import { AgentsService, type ThreadView } from "./agents.service.js";
import { proxyEventStream } from "./event-stream.js";

// The admin console's docs assistant: explains how Platform Base is built, answering
// from the repository's docs (apps/agents/src/agents_service/agents/docs/).
// A platform-level agent: superadmins have no organization, so none is sent.
const AGENT = "docs";
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
			this.agents.chat(
				AGENT,
				{ userId: session.user.id },
				toChatRequest(body),
				signal,
			),
		);
	}

	@Get("threads/:id")
	@RequirePermissions({ "docs-assistant": ["use"] })
	@ApiOperation({ summary: "A conversation with the docs assistant" })
	@ApiNotFoundResponse({ description: "No such conversation for this user" })
	thread(
		@CurrentSession() session: Session,
		@Param("id", ThreadIdPipe) id: string,
	): Promise<ThreadView> {
		return this.agents.thread(AGENT, { userId: session.user.id }, id);
	}
}

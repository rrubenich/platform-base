import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Res,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import {
	ApiAcceptedResponse,
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
import { CurrentSession } from "../auth/auth.decorators.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { Session } from "../lib/auth.js";
import {
	AGENT_CHAT_EVENTS,
	ChatDto,
	CreateJobDto,
	ThreadIdPipe,
	toChatRequest,
} from "./agents.dto.js";
import {
	AgentsService,
	type JobCreated,
	type JobView,
	type ThreadView,
} from "./agents.service.js";
import { proxyEventStream } from "./event-stream.js";

// Public face of the assistant agent in apps/agents. Any member of the
// session's active organization can use it; the agents service only sees the
// user and organization ids this controller forwards. Conversations are kept
// by the agents service, per user and organization.
const AGENT = "assistant";
@ApiTags("agents")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "Not signed in" })
@ApiForbiddenResponse({
	description: "No active organization, or no longer a member of it",
})
@ApiBadRequestResponse({ description: "Invalid input" })
@UseGuards(AuthGuard)
@UsePipes(
	new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
	}),
)
@Controller("agents/assistant")
export class AgentsController {
	constructor(private readonly agents: AgentsService) {}

	@Post("chat")
	@ApiOperation({
		summary: "Chat with the assistant, streamed as server-sent events",
		description: AGENT_CHAT_EVENTS,
	})
	@ApiOkResponse({ content: { "text/event-stream": {} } })
	async chat(
		@CurrentSession() session: Session,
		@Body() body: ChatDto,
		@Res() response: Response,
	): Promise<void> {
		const caller = await this.agents.callerFor(session);
		await proxyEventStream(response, (signal) =>
			this.agents.chat(AGENT, caller, toChatRequest(body), signal),
		);
	}

	@Get("threads/:id")
	@ApiOperation({ summary: "A conversation with the assistant, to reopen it" })
	@ApiNotFoundResponse({ description: "No such conversation for this user" })
	async thread(
		@CurrentSession() session: Session,
		@Param("id", ThreadIdPipe) id: string,
	): Promise<ThreadView> {
		const caller = await this.agents.callerFor(session);
		return this.agents.thread(AGENT, caller, id);
	}

	@Post("jobs")
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({ summary: "Run the assistant in the background" })
	@ApiAcceptedResponse({ description: "Queued; poll GET jobs/:id" })
	async createJob(
		@CurrentSession() session: Session,
		@Body() body: CreateJobDto,
	): Promise<JobCreated> {
		const caller = await this.agents.callerFor(session);
		return this.agents.createJob(AGENT, caller, body);
	}

	@Get("jobs/:id")
	@ApiOperation({ summary: "A background job's status and result" })
	@ApiNotFoundResponse({
		description: "No such job in the active organization",
	})
	async getJob(
		@CurrentSession() session: Session,
		@Param("id") id: string,
	): Promise<JobView> {
		const caller = await this.agents.callerFor(session);
		return this.agents.getJob(AGENT, caller, id);
	}
}

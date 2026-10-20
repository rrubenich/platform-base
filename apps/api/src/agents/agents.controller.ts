import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
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
import { ChatDto, CreateJobDto } from "./agents.dto.js";
import {
	AgentsService,
	type JobCreated,
	type JobView,
} from "./agents.service.js";

// Public face of the assistant agent in apps/agents. Any member of the
// session's active organization can use it; the agents service only sees the
// user and organization ids this controller forwards.
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
		description:
			"Events: `delta` (`{text}`) as the reply is written, then `done` or `error` (`{code, message}`).",
	})
	@ApiOkResponse({ content: { "text/event-stream": {} } })
	async chat(
		@CurrentSession() session: Session,
		@Body() body: ChatDto,
		@Res() response: Response,
	): Promise<void> {
		const caller = await this.agents.callerFor(session);
		// Stop generating (and paying for) tokens once the browser goes away.
		const abort = new AbortController();
		response.on("close", () => abort.abort());

		const upstream = await this.agents.chat(caller, body, abort.signal);
		response.status(HttpStatus.OK).set({
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			// Keeps reverse proxies from buffering the stream.
			"X-Accel-Buffering": "no",
		});
		response.flushHeaders();
		if (!upstream.body) {
			response.end();
			return;
		}
		Readable.fromWeb(upstream.body as ReadableStream)
			.on("error", () => response.end())
			.pipe(response);
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
		return this.agents.createJob(caller, body);
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
		return this.agents.getJob(caller, id);
	}
}

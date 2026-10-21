import {
	BadRequestException,
	Injectable,
	type PipeTransform,
} from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";
import type { ChatRequest, JobRequest } from "./agents.service.js";

// Validated here as well as in apps/agents so a bad request is a 400 from
// this API instead of a 502 from the proxy.
const MAX_MESSAGE_LENGTH = 100_000;

/** Must match THREAD_ID_PATTERN in apps/agents (platform/chat.py). */
export const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const AGENT_CHAT_EVENTS =
	"Events: `thread` (`{id}`) first, naming the conversation to continue; `delta` (`{text}`) as the reply is written; `tool` (`{name, args}`) when the agent uses a tool or asks another agent (`ask_<agent>`); then `done` or `error` (`{code, message}`).";

export class ChatDto {
	@ApiProperty({ description: "The user's new message" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAX_MESSAGE_LENGTH)
	message!: string;

	@ApiPropertyOptional({
		description:
			"The conversation to continue, from an earlier `thread` event; omit to start a new one",
		pattern: THREAD_ID_PATTERN.source,
	})
	@IsOptional()
	@IsString()
	@Matches(THREAD_ID_PATTERN)
	threadId?: string;
}

/** The agents service's request for a chat turn. */
export function toChatRequest(dto: ChatDto): ChatRequest {
	return { message: dto.message, thread_id: dto.threadId ?? null };
}

export class CreateJobDto implements JobRequest {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAX_MESSAGE_LENGTH)
	prompt!: string;
}

/** Rejects a thread id the agents service would refuse, with a 400. */
@Injectable()
export class ThreadIdPipe implements PipeTransform<string, string> {
	transform(value: string): string {
		if (!THREAD_ID_PATTERN.test(value)) {
			throw new BadRequestException("Invalid thread id");
		}
		return value;
	}
}

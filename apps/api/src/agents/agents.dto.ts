import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMinSize,
	IsIn,
	IsNotEmpty,
	IsString,
	MaxLength,
	ValidateNested,
} from "class-validator";
import type { ChatRequest, JobRequest } from "./agents.service.js";

// Validated here as well as in apps/agents so a bad request is a 400 from
// this API instead of a 502 from the proxy.
const MAX_MESSAGE_LENGTH = 100_000;

export class ChatMessageDto {
	@ApiProperty({ enum: ["user", "assistant"] })
	@IsIn(["user", "assistant"])
	role!: "user" | "assistant";

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAX_MESSAGE_LENGTH)
	content!: string;
}

export class ChatDto implements ChatRequest {
	@ApiProperty({
		type: [ChatMessageDto],
		description: "The whole conversation so far, ending with the user's turn",
	})
	@ValidateNested({ each: true })
	@ArrayMinSize(1)
	@Type(() => ChatMessageDto)
	messages!: ChatMessageDto[];
}

export class CreateJobDto implements JobRequest {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(MAX_MESSAGE_LENGTH)
	prompt!: string;
}

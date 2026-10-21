import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEmail,
	IsNotEmpty,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";
import { SLUG_PATTERN } from "../admin/organizations/organizations.dto.js";

// Mirrors emailAndPassword's policy in lib/auth.ts.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export class CreateAccountInvitationBody {
	@ApiProperty({ example: "jane@acme.com" })
	@IsEmail()
	@MaxLength(254)
	email: string;

	@ApiProperty({ example: "Acme Inc." })
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	organizationName: string;

	@ApiProperty({ example: "acme-inc" })
	@Matches(SLUG_PATTERN, {
		message: "slug must be lowercase letters, numbers and dashes",
	})
	@MaxLength(100)
	slug: string;
}

export class AcceptAccountInvitationBody {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	@ApiProperty({
		minLength: MIN_PASSWORD_LENGTH,
		maxLength: MAX_PASSWORD_LENGTH,
	})
	@IsString()
	@MinLength(MIN_PASSWORD_LENGTH)
	@MaxLength(MAX_PASSWORD_LENGTH)
	password: string;
}

export class AccountInvitationsQuery {
	@ApiProperty({
		description: "Comma-separated user ids",
		type: String,
		example: "user-1,user-2",
	})
	@Transform(({ value }) =>
		typeof value === "string" ? value.split(",").filter(Boolean) : value,
	)
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@IsString({ each: true })
	userIds: string[];
}

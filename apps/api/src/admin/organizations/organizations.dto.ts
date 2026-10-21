import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
} from "class-validator";

// The organization plugin's default per-org roles.
export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ListOrganizationsQuery {
	@ApiPropertyOptional({ description: "Matches name or slug" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;

	@ApiPropertyOptional({ default: 0, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset = 0;
}

export class CreateOrganizationBody {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	@ApiProperty({ example: "acme-inc" })
	@Matches(SLUG_PATTERN, {
		message: "slug must be lowercase letters, numbers and dashes",
	})
	@MaxLength(100)
	slug: string;

	@ApiProperty({ description: "Existing user who becomes the owner" })
	@IsString()
	@IsNotEmpty()
	ownerUserId: string;
}

export class UpdateOrganizationBody {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@Matches(SLUG_PATTERN, {
		message: "slug must be lowercase letters, numbers and dashes",
	})
	@MaxLength(100)
	slug?: string;
}

export class AddMemberBody {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	userId: string;

	@ApiProperty({ enum: MEMBER_ROLES })
	@IsIn(MEMBER_ROLES)
	role: MemberRole;
}

export class UpdateMemberRoleBody {
	@ApiProperty({ enum: MEMBER_ROLES })
	@IsIn(MEMBER_ROLES)
	role: MemberRole;
}

export class TeamBody {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;
}

export class AddTeamMemberBody {
	@ApiProperty({ description: "Must already be a member of the organization" })
	@IsString()
	@IsNotEmpty()
	userId: string;
}

import { m } from "@workspace/i18n/messages";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { MEMBER_ROLES, type MemberRole } from "@/lib/admin-api";

export const memberRoleLabel = (role: string) =>
	({
		owner: m.admin_member_role_owner(),
		admin: m.admin_member_role_admin(),
		member: m.admin_member_role_member(),
	})[role] ?? role;

const isMemberRole = (value: unknown): value is MemberRole =>
	MEMBER_ROLES.includes(value as MemberRole);

/** The organization plugin's per-org roles. */
export function RoleSelect({
	id,
	value,
	onChange,
	size = "default",
	disabled,
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: string;
	onChange: (role: MemberRole) => void;
	size?: "sm" | "default";
	disabled?: boolean;
	"aria-label"?: string;
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				if (isMemberRole(next)) onChange(next);
			}}
			disabled={disabled}
		>
			<SelectTrigger
				id={id}
				size={size}
				aria-label={ariaLabel}
				className="w-32"
			>
				<SelectValue>
					{(current: string) => memberRoleLabel(current)}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{MEMBER_ROLES.map((role) => (
						<SelectItem key={role} value={role}>
							{memberRoleLabel(role)}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

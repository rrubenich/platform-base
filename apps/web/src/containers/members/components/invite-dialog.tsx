import { m } from "@workspace/i18n/messages";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { useState } from "react";
import { FormDialog } from "@/components/admin/form-dialog";
import { RoleSelect } from "@/components/role-select";
import { MEMBER_ROLES, type MemberRole } from "@/lib/admin-api";
import { useMembersContext } from "../members.context";

const NO_TEAM = "none";

export function InviteDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { organization, viewerRole, invite } = useMembersContext();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<MemberRole>("member");
	const [teamId, setTeamId] = useState(NO_TEAM);

	const teams = organization?.teams ?? [];
	const roles: readonly MemberRole[] =
		viewerRole === "owner" ? MEMBER_ROLES : ["admin", "member"];

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) {
					setEmail("");
					setRole("member");
					setTeamId(NO_TEAM);
				}
			}}
			title={m.members_invite_title()}
			description={m.members_invite_description()}
			submitLabel={m.members_invite_submit()}
			onSubmit={() =>
				invite({
					email,
					role,
					teamId: teamId === NO_TEAM ? undefined : teamId,
				})
			}
		>
			<Field>
				<FieldLabel htmlFor="invite-email">
					{m.members_invite_email_label()}
				</FieldLabel>
				<Input
					id="invite-email"
					type="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="invite-role">
					{m.members_invite_role_label()}
				</FieldLabel>
				<RoleSelect
					id="invite-role"
					value={role}
					roles={roles}
					onChange={setRole}
				/>
			</Field>
			{teams.length > 0 && (
				<Field>
					<FieldLabel htmlFor="invite-team">
						{m.members_invite_team_label()}
					</FieldLabel>
					<Select
						value={teamId}
						onValueChange={(next) => {
							if (typeof next === "string") setTeamId(next);
						}}
					>
						<SelectTrigger id="invite-team" className="w-full">
							<SelectValue>
								{(current: string) =>
									teams.find(({ id }) => id === current)?.name ??
									m.members_invite_team_none()
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value={NO_TEAM}>
									{m.members_invite_team_none()}
								</SelectItem>
								{teams.map((team) => (
									<SelectItem key={team.id} value={team.id}>
										{team.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
			)}
		</FormDialog>
	);
}

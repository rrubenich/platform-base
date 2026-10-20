import { m } from "@workspace/i18n/messages";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@workspace/ui/components/field";
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
import { useTeamContext } from "../team.context";

export function AddMemberDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { candidates, add } = useTeamContext();
	const [userId, setUserId] = useState("");

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setUserId("");
			}}
			title={m.teams_member_add_title()}
			description={m.teams_member_add_description()}
			submitLabel={m.teams_member_add_submit()}
			onSubmit={() =>
				userId ? add(userId) : Promise.resolve(m.teams_member_add_error())
			}
		>
			<Field>
				<FieldLabel htmlFor="team-member">{m.teams_member_label()}</FieldLabel>
				<Select
					value={userId}
					disabled={candidates.length === 0}
					onValueChange={(next) => {
						if (typeof next === "string") setUserId(next);
					}}
				>
					<SelectTrigger id="team-member" className="w-full">
						<SelectValue>
							{(current: string) =>
								candidates.find((member) => member.userId === current)?.user
									.name ?? m.teams_member_placeholder()
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{candidates.map((member) => (
								<SelectItem key={member.userId} value={member.userId}>
									{member.user.name}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				{candidates.length === 0 && (
					<FieldDescription>{m.teams_member_all_added()}</FieldDescription>
				)}
			</Field>
		</FormDialog>
	);
}

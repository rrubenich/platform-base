import { m } from "@workspace/i18n/messages";
import { Field, FieldLabel } from "@workspace/ui/components/field";
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
import { useOrganizationSettingsContext } from "../organization-settings.context";

export function TransferOwnershipDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { otherMembers, transferOwnership } = useOrganizationSettingsContext();
	const [memberId, setMemberId] = useState("");

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setMemberId("");
			}}
			title={m.org_settings_transfer_title()}
			description={m.org_settings_transfer_description()}
			submitLabel={m.org_settings_transfer_submit()}
			onSubmit={() =>
				memberId
					? transferOwnership(memberId)
					: Promise.resolve(m.org_settings_transfer_error())
			}
		>
			<Field>
				<FieldLabel htmlFor="transfer-member">
					{m.org_settings_transfer_member_label()}
				</FieldLabel>
				<Select
					value={memberId}
					onValueChange={(next) => {
						if (typeof next === "string") setMemberId(next);
					}}
				>
					<SelectTrigger id="transfer-member" className="w-full">
						<SelectValue>
							{(current: string) =>
								otherMembers.find(({ id }) => id === current)?.user.name ??
								m.org_settings_transfer_member_placeholder()
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{otherMembers.map((member) => (
								<SelectItem key={member.id} value={member.id}>
									{member.user.name}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
		</FormDialog>
	);
}

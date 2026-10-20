import { m } from "@workspace/i18n/messages";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";
import { FormDialog } from "@/components/admin/form-dialog";

/** Create or rename: a dialog with the one name field. */
export function TeamFormDialog({
	open,
	onOpenChange,
	title,
	description,
	submitLabel,
	initialName = "",
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	submitLabel: string;
	initialName?: string;
	onSubmit: (name: string) => Promise<string | null>;
}) {
	const [name, setName] = useState(initialName);

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setName(initialName);
			}}
			title={title}
			description={description}
			submitLabel={submitLabel}
			onSubmit={() => onSubmit(name.trim())}
		>
			<Field>
				<FieldLabel htmlFor="team-name">{m.teams_name_label()}</FieldLabel>
				<Input
					id="team-name"
					required
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</Field>
		</FormDialog>
	);
}

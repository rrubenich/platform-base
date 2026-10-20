import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import type { OrganizationDetails } from "@/lib/organization";
import { useOrganizationSettingsContext } from "../organization-settings.context";

/** Deleting asks for the organization's name, typed exactly. */
export function DeleteOrganizationDialog({
	organization,
	open,
	onOpenChange,
}: {
	organization: OrganizationDetails;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { deleteOrganization } = useOrganizationSettingsContext();
	const [typed, setTyped] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setSubmitting] = useState(false);

	function close(next: boolean) {
		onOpenChange(next);
		if (!next) {
			setTyped("");
			setError(null);
		}
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		const failure = await deleteOrganization();
		setSubmitting(false);
		setError(failure);
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-6">
					<DialogHeader>
						<DialogTitle>
							{m.org_settings_delete_dialog_title({ name: organization.name })}
						</DialogTitle>
						<DialogDescription>
							{m.org_settings_delete_dialog_description()}
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="delete-organization-name">
								{m.org_settings_delete_confirm_label({
									name: organization.name,
								})}
							</FieldLabel>
							<Input
								id="delete-organization-name"
								autoComplete="off"
								value={typed}
								onChange={(event) => setTyped(event.target.value)}
							/>
						</Field>
						{error && <FieldError>{error}</FieldError>}
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => close(false)}
						>
							{m.admin_cancel()}
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={isSubmitting || typed !== organization.name}
						>
							{isSubmitting && <Spinner data-icon="inline-start" />}
							{m.org_settings_delete_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

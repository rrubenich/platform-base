import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import { useAdminOrganizationsContext } from "../admin-organizations.context";
import { slugify } from "../admin-organizations.search";

export function CreateOrganizationDialog() {
	const { createOrganization, isCreating } = useAdminOrganizationsContext();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugEdited, setSlugEdited] = useState(false);
	const [ownerEmail, setOwnerEmail] = useState("");
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setName("");
		setSlug("");
		setSlugEdited(false);
		setOwnerEmail("");
		setError(null);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		const failure = await createOrganization({
			name: name.trim(),
			slug,
			ownerEmail,
		});
		if (failure) {
			setError(failure);
			return;
		}
		setOpen(false);
		reset();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger render={<Button />}>
				<HugeiconsIcon
					icon={PlusSignIcon}
					strokeWidth={2}
					data-icon="inline-start"
				/>
				{m.admin_org_create()}
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-6">
					<DialogHeader>
						<DialogTitle>{m.admin_org_create()}</DialogTitle>
						<DialogDescription>
							{m.admin_org_create_description()}
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="org-name">
								{m.admin_org_name_label()}
							</FieldLabel>
							<Input
								id="org-name"
								required
								maxLength={100}
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									if (!isSlugEdited) setSlug(slugify(event.target.value));
								}}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="org-slug">
								{m.admin_org_slug_label()}
							</FieldLabel>
							<Input
								id="org-slug"
								required
								maxLength={100}
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								value={slug}
								onChange={(event) => {
									setSlugEdited(true);
									setSlug(event.target.value);
								}}
							/>
							<FieldDescription>{m.admin_org_slug_hint()}</FieldDescription>
						</Field>
						<Field data-invalid={error ? true : undefined}>
							<FieldLabel htmlFor="org-owner">
								{m.admin_org_owner_label()}
							</FieldLabel>
							<Input
								id="org-owner"
								type="email"
								required
								value={ownerEmail}
								aria-invalid={error ? true : undefined}
								onChange={(event) => setOwnerEmail(event.target.value)}
							/>
							{error ? (
								<FieldError>{error}</FieldError>
							) : (
								<FieldDescription>{m.admin_org_owner_hint()}</FieldDescription>
							)}
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							{m.admin_cancel()}
						</Button>
						<Button type="submit" disabled={isCreating}>
							{isCreating && <Spinner data-icon="inline-start" />}
							{m.admin_org_create_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

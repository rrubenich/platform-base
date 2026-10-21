import { MailSend01Icon } from "@hugeicons/core-free-icons";
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
import { slugify } from "@/lib/slugify";
import {
	type InviteClientError,
	useAdminOrganizationsContext,
} from "../admin-organizations.context";

/**
 * Creates someone's account as the owner of a new organization; they get an
 * email to set up their login.
 */
export function InviteClientDialog() {
	const { inviteClient, isInviting } = useAdminOrganizationsContext();
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [isSlugEdited, setSlugEdited] = useState(false);
	const [error, setError] = useState<InviteClientError | null>(null);

	function reset() {
		setEmail("");
		setName("");
		setSlug("");
		setSlugEdited(false);
		setError(null);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		const failure = await inviteClient({
			email: email.trim(),
			organizationName: name.trim(),
			slug,
		});
		if (failure) {
			setError(failure);
			return;
		}
		setOpen(false);
		reset();
	}

	const emailError = error?.field === "email" ? error.message : null;
	const slugError = error?.field === "slug" ? error.message : null;
	const formError = error && !error.field ? error.message : null;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger render={<Button variant="outline" />}>
				<HugeiconsIcon
					icon={MailSend01Icon}
					strokeWidth={2}
					data-icon="inline-start"
				/>
				{m.admin_org_invite()}
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-6">
					<DialogHeader>
						<DialogTitle>{m.admin_org_invite()}</DialogTitle>
						<DialogDescription>
							{m.admin_org_invite_description()}
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field data-invalid={emailError ? true : undefined}>
							<FieldLabel htmlFor="invite-email">
								{m.admin_org_invite_email_label()}
							</FieldLabel>
							<Input
								id="invite-email"
								type="email"
								required
								maxLength={254}
								value={email}
								aria-invalid={emailError ? true : undefined}
								onChange={(event) => setEmail(event.target.value)}
							/>
							{emailError ? (
								<FieldError>{emailError}</FieldError>
							) : (
								<FieldDescription>
									{m.admin_org_invite_email_hint()}
								</FieldDescription>
							)}
						</Field>
						<Field>
							<FieldLabel htmlFor="invite-org-name">
								{m.admin_org_name_label()}
							</FieldLabel>
							<Input
								id="invite-org-name"
								required
								maxLength={100}
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									if (!isSlugEdited) setSlug(slugify(event.target.value));
								}}
							/>
						</Field>
						<Field data-invalid={slugError ? true : undefined}>
							<FieldLabel htmlFor="invite-org-slug">
								{m.admin_org_slug_label()}
							</FieldLabel>
							<Input
								id="invite-org-slug"
								required
								maxLength={100}
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								value={slug}
								aria-invalid={slugError ? true : undefined}
								onChange={(event) => {
									setSlugEdited(true);
									setSlug(event.target.value);
								}}
							/>
							{slugError ? (
								<FieldError>{slugError}</FieldError>
							) : (
								<FieldDescription>{m.admin_org_slug_hint()}</FieldDescription>
							)}
						</Field>
						{formError && <FieldError>{formError}</FieldError>}
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							{m.admin_cancel()}
						</Button>
						<Button type="submit" disabled={isInviting}>
							{isInviting && <Spinner data-icon="inline-start" />}
							{m.admin_org_invite_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

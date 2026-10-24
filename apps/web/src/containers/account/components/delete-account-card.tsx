import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import { type AccountUser, useAccountContext } from "../account.context";

/** Deletes the account for good, after the password (or a recent sign-in). */
export function DeleteAccountCard({ user }: { user: AccountUser }) {
	const { hasPassword, deleteAccount } = useAccountContext();
	const [open, setOpen] = useState(false);
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function onOpenChange(next: boolean) {
		setOpen(next);
		if (!next) setError(null);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const password = hasPassword
			? String(new FormData(event.currentTarget).get("password") ?? "")
			: undefined;
		setSubmitting(true);
		setError(null);
		const failure = await deleteAccount(password);
		setSubmitting(false);
		if (failure) setError(failure);
	}

	return (
		<Card className="border-destructive/40">
			<CardHeader>
				<CardTitle>{m.account_delete_title()}</CardTitle>
				<CardDescription>{m.account_delete_description()}</CardDescription>
			</CardHeader>
			<CardFooter>
				<Button variant="destructive" onClick={() => setOpen(true)}>
					{m.account_delete_button()}
				</Button>
			</CardFooter>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent>
					<form onSubmit={submit} className="flex flex-col gap-6">
						<DialogHeader>
							<DialogTitle>{m.account_delete_confirm_title()}</DialogTitle>
							<DialogDescription>
								{m.account_delete_confirm_description({ email: user.email })}
							</DialogDescription>
						</DialogHeader>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							{hasPassword ? (
								<Field>
									<FieldLabel htmlFor="account-delete-password">
										{m.account_delete_password_label()}
									</FieldLabel>
									<Input
										id="account-delete-password"
										name="password"
										type="password"
										autoComplete="current-password"
										required
									/>
								</Field>
							) : (
								<FieldDescription>
									{m.account_delete_social_hint()}
								</FieldDescription>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={isSubmitting}
								onClick={() => onOpenChange(false)}
							>
								{m.account_delete_cancel()}
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={isSubmitting}
							>
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{m.account_delete_confirm()}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

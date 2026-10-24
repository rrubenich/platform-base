import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import { type AccountUser, useAccountContext } from "../account.context";

/** Starts an email change: the current address confirms, the new one verifies. */
export function EmailCard({ user }: { user: AccountUser }) {
	const { changeEmail } = useAccountContext();
	const [newEmail, setNewEmail] = useState("");
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const email = newEmail.trim().toLowerCase();
		if (email === user.email.toLowerCase()) {
			setError(m.account_email_same());
			return;
		}
		setSubmitting(true);
		setError(null);
		const failure = await changeEmail(email);
		setSubmitting(false);
		if (failure) {
			setError(failure);
		} else {
			setSentTo(user.email);
			setNewEmail("");
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.account_email_title()}</CardTitle>
				<CardDescription>{m.account_email_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit}>
					<FieldGroup>
						{sentTo && (
							<Alert>
								<AlertDescription>
									{m.account_email_sent({ email: sentTo })}
								</AlertDescription>
							</Alert>
						)}
						<FieldError>{error}</FieldError>
						<Field>
							<FieldLabel htmlFor="account-new-email">
								{m.account_email_new_label()}
							</FieldLabel>
							<Input
								id="account-new-email"
								type="email"
								value={newEmail}
								onChange={(event) => setNewEmail(event.target.value)}
								placeholder={user.email}
								autoComplete="email"
								required
							/>
						</Field>
						<Field orientation="horizontal">
							<Button
								type="submit"
								variant="outline"
								disabled={!newEmail.trim() || isSubmitting}
							>
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{m.account_email_submit()}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

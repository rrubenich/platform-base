import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "@/lib/password-policy";
import { useAccountContext } from "../account.context";

/** Sends the reset link that sets a first password, for accounts without one. */
function SetPassword({ email }: { email: string }) {
	const { sendSetPasswordLink } = useAccountContext();
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	async function send() {
		setSubmitting(true);
		setError(null);
		const failure = await sendSetPasswordLink();
		setSubmitting(false);
		setError(failure);
		setSent(!failure);
	}

	return (
		<FieldGroup>
			<FieldError>{error}</FieldError>
			{sent ? (
				<FieldDescription role="status">
					{m.account_password_set_sent({ email })}
				</FieldDescription>
			) : (
				<Field orientation="horizontal">
					<Button
						variant="outline"
						disabled={isSubmitting}
						onClick={() => void send()}
					>
						{isSubmitting && <Spinner data-icon="inline-start" />}
						{m.account_password_set()}
					</Button>
				</Field>
			)}
		</FieldGroup>
	);
}

export function PasswordCard({ email }: { email: string }) {
	const { hasPassword, changePassword } = useAccountContext();
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const currentPassword = String(data.get("currentPassword") ?? "");
		const newPassword = String(data.get("newPassword") ?? "");
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			setError(m.account_password_too_short({ min: MIN_PASSWORD_LENGTH }));
			return;
		}
		if (newPassword !== data.get("confirmPassword")) {
			setError(m.account_password_mismatch());
			return;
		}
		setSubmitting(true);
		setError(null);
		const failure = await changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions,
		});
		setSubmitting(false);
		if (failure) setError(failure);
		else form.reset();
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.account_password_title()}</CardTitle>
				<CardDescription>
					{hasPassword
						? m.account_password_description()
						: m.account_password_none()}
				</CardDescription>
			</CardHeader>
			{!hasPassword && (
				<CardContent>
					<SetPassword email={email} />
				</CardContent>
			)}
			{hasPassword && (
				<CardContent>
					<form onSubmit={submit}>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							<Field>
								<FieldLabel htmlFor="account-current-password">
									{m.account_password_current()}
								</FieldLabel>
								<Input
									id="account-current-password"
									name="currentPassword"
									type="password"
									autoComplete="current-password"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="account-new-password">
									{m.account_password_new()}
								</FieldLabel>
								<Input
									id="account-new-password"
									name="newPassword"
									type="password"
									autoComplete="new-password"
									maxLength={MAX_PASSWORD_LENGTH}
									required
								/>
								<FieldDescription>
									{m.account_password_hint({
										min: MIN_PASSWORD_LENGTH,
										max: MAX_PASSWORD_LENGTH,
									})}
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="account-confirm-password">
									{m.account_password_confirm()}
								</FieldLabel>
								<Input
									id="account-confirm-password"
									name="confirmPassword"
									type="password"
									autoComplete="new-password"
									maxLength={MAX_PASSWORD_LENGTH}
									required
								/>
							</Field>
							<Field orientation="horizontal">
								<Checkbox
									id="account-revoke-sessions"
									checked={revokeOtherSessions}
									onCheckedChange={(checked) =>
										setRevokeOtherSessions(checked === true)
									}
								/>
								<FieldLabel htmlFor="account-revoke-sessions">
									{m.account_password_revoke()}
								</FieldLabel>
							</Field>
							<Field orientation="horizontal">
								<Button type="submit" variant="outline" disabled={isSubmitting}>
									{isSubmitting && <Spinner data-icon="inline-start" />}
									{m.account_password_submit()}
								</Button>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			)}
		</Card>
	);
}

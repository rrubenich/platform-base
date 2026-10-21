import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
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
import type { WelcomeValues } from "../welcome.context";

function validatePassword(password: string, confirmPassword: string) {
	if (
		password.length < MIN_PASSWORD_LENGTH ||
		password.length > MAX_PASSWORD_LENGTH
	) {
		return m.sign_up_error_password_length({
			min: MIN_PASSWORD_LENGTH,
			max: MAX_PASSWORD_LENGTH,
		});
	}
	if (password !== confirmPassword) {
		return m.sign_up_error_password_mismatch();
	}
	return null;
}

export function WelcomeForm({
	email,
	onSubmit,
}: {
	email: string;
	/** Resolves to an error message, or null on success. */
	onSubmit: (values: WelcomeValues) => Promise<string | null>;
}) {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const password = String(data.get("password") ?? "");
		const invalid = validatePassword(
			password,
			String(data.get("confirm-password") ?? ""),
		);
		setError(invalid);
		if (invalid) return;

		setSubmitting(true);
		const failure = await onSubmit({
			name: String(data.get("name") ?? "").trim(),
			password,
		});
		setSubmitting(false);
		setError(failure);
	}

	return (
		<form onSubmit={handleSubmit}>
			<FieldGroup>
				<FieldError>{error}</FieldError>
				<Field>
					<FieldLabel htmlFor="email">{m.sign_up_email_label()}</FieldLabel>
					<Input id="email" type="email" value={email} readOnly />
				</Field>
				<Field>
					<FieldLabel htmlFor="name">{m.welcome_name_label()}</FieldLabel>
					<Input
						id="name"
						name="name"
						type="text"
						autoComplete="name"
						maxLength={100}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="password">
						{m.sign_up_password_label()}
					</FieldLabel>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						maxLength={MAX_PASSWORD_LENGTH}
						required
					/>
					<FieldDescription>
						{m.sign_up_password_hint({ min: MIN_PASSWORD_LENGTH })}
					</FieldDescription>
				</Field>
				<Field>
					<FieldLabel htmlFor="confirm-password">
						{m.sign_up_confirm_password_label()}
					</FieldLabel>
					<Input
						id="confirm-password"
						name="confirm-password"
						type="password"
						autoComplete="new-password"
						maxLength={MAX_PASSWORD_LENGTH}
						required
					/>
				</Field>
				<Field>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Spinner data-icon="inline-start" />}
						{m.welcome_submit()}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}

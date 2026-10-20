import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
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
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { type FormEvent, useState } from "react";
import { type SocialProvider, SocialSignOn } from "@/components/social-sign-on";
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "@/lib/password-policy";
import type { AuthSearch } from "@/lib/redirect-target";

export type SignUpValues = { name: string; email: string; password: string };

export type SignUpFormProps = Omit<React.ComponentProps<"div">, "children"> & {
	onSignUp: (values: SignUpValues) => void;
	onSocialSignUp: (provider: SocialProvider) => void;
	isSubmitting?: boolean;
	error?: string | null;
	/** The address a verification email was sent to, once sign-up succeeds. */
	verificationSentTo?: string | null;
	/** Prefills the email and makes it read-only. */
	lockedEmail?: string;
	/** Kept on the link to sign-in. */
	authSearch?: AuthSearch;
};

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

export function SignUpForm({
	className,
	onSignUp,
	onSocialSignUp,
	isSubmitting = false,
	error,
	verificationSentTo,
	lockedEmail,
	authSearch,
	...props
}: SignUpFormProps) {
	const [validationError, setValidationError] = useState<string | null>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const password = String(data.get("password") ?? "");
		const invalid = validatePassword(
			password,
			String(data.get("confirm-password") ?? ""),
		);

		setValidationError(invalid);
		if (invalid) return;

		onSignUp({
			name: String(data.get("name") ?? "").trim(),
			email: String(data.get("email") ?? "").trim(),
			password,
		});
	}

	const signInLink = (
		<FieldDescription className="text-center">
			{m.sign_up_have_account()}{" "}
			<Link to="/sign-in" search={authSearch}>
				{m.sign_up_sign_in()}
			</Link>
		</FieldDescription>
	);

	if (verificationSentTo) {
		return (
			<div className={cn("flex flex-col gap-6", className)} {...props}>
				<Card>
					<CardHeader>
						<CardTitle>{m.sign_up_verification_title()}</CardTitle>
						<CardDescription role="status">
							{m.sign_up_verification_sent({ email: verificationSentTo })}
						</CardDescription>
					</CardHeader>
					<CardContent>{signInLink}</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>{m.sign_up_title()}</CardTitle>
					<CardDescription>{m.sign_up_description()}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<FieldError>{validationError ?? error}</FieldError>
							<Field>
								<FieldLabel htmlFor="name">{m.sign_up_name_label()}</FieldLabel>
								<Input
									id="name"
									name="name"
									type="text"
									autoComplete="name"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="email">
									{m.sign_up_email_label()}
								</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									placeholder="m@example.com"
									defaultValue={lockedEmail}
									readOnly={lockedEmail !== undefined}
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
									{m.sign_up_submit()}
								</Button>
							</Field>
							<SocialSignOn
								label={m.sign_up_social}
								onSelect={onSocialSignUp}
								disabled={isSubmitting}
							/>
							{signInLink}
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
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
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "@/lib/password-policy";
import { useResetPasswordContext } from "./reset-password.context";

function NewPasswordForm() {
	const { isSubmitting, error, reset } = useResetPasswordContext();
	const [localError, setLocalError] = useState<string | null>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const newPassword = String(data.get("newPassword") ?? "");
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			setLocalError(m.account_password_too_short({ min: MIN_PASSWORD_LENGTH }));
			return;
		}
		if (newPassword !== data.get("confirmPassword")) {
			setLocalError(m.account_password_mismatch());
			return;
		}
		setLocalError(null);
		void reset(newPassword);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.reset_password_title()}</CardTitle>
				<CardDescription>{m.reset_password_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<FieldError>{localError ?? error}</FieldError>
						<Field>
							<FieldLabel htmlFor="new-password">
								{m.account_password_new()}
							</FieldLabel>
							<Input
								id="new-password"
								name="newPassword"
								type="password"
								autoComplete="new-password"
								maxLength={MAX_PASSWORD_LENGTH}
								autoFocus
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
							<FieldLabel htmlFor="confirm-password">
								{m.account_password_confirm()}
							</FieldLabel>
							<Input
								id="confirm-password"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								maxLength={MAX_PASSWORD_LENGTH}
								required
							/>
						</Field>
						<Field>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{m.reset_password_submit()}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function Message({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action: { to: "/sign-in" | "/forgot-password"; label: string };
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardFooter>
				<Link to={action.to} className={buttonVariants()}>
					{action.label}
				</Link>
			</CardFooter>
		</Card>
	);
}

export function ResetPasswordPage() {
	const { step } = useResetPasswordContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				{step === "form" ? (
					<NewPasswordForm />
				) : step === "done" ? (
					<Message
						title={m.reset_password_done_title()}
						description={m.reset_password_done_description()}
						action={{ to: "/sign-in", label: m.reset_password_sign_in() }}
					/>
				) : (
					<Message
						title={m.reset_password_invalid_title()}
						description={m.reset_password_invalid_description()}
						action={{
							to: "/forgot-password",
							label: m.reset_password_request_new(),
						}}
					/>
				)}
				<LocaleSwitcher />
			</div>
		</div>
	);
}

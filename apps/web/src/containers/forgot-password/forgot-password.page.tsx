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
import { Spinner } from "@workspace/ui/components/spinner";
import type { FormEvent } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useForgotPasswordContext } from "./forgot-password.context";

export function ForgotPasswordPage() {
	const { initialEmail, authSearch, isSubmitting, error, sentTo, requestLink } =
		useForgotPasswordContext();

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const email = String(new FormData(event.currentTarget).get("email") ?? "");
		void requestLink(email.trim());
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{m.forgot_password_title()}</CardTitle>
						<CardDescription>{m.forgot_password_description()}</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit}>
							<FieldGroup>
								<FieldError>{error}</FieldError>
								{sentTo && (
									<FieldDescription role="status">
										{m.forgot_password_sent({ email: sentTo })}
									</FieldDescription>
								)}
								<Field>
									<FieldLabel htmlFor="email">
										{m.sign_in_email_label()}
									</FieldLabel>
									<Input
										id="email"
										name="email"
										type="email"
										placeholder="m@example.com"
										defaultValue={initialEmail}
										autoComplete="email"
										required
									/>
								</Field>
								<Field>
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting && <Spinner data-icon="inline-start" />}
										{m.forgot_password_submit()}
									</Button>
									<FieldDescription className="text-center">
										<Link to="/sign-in" search={authSearch}>
											{m.forgot_password_back()}
										</Link>
									</FieldDescription>
								</Field>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

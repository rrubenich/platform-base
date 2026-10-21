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
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignUpForm } from "./components/sign-up-form";
import { useSignUpContext } from "./sign-up.context";

export function SignUpPage() {
	const {
		isSubmitting,
		error,
		verificationSentTo,
		lockedEmail,
		authSearch,
		signUpWithPassword,
		signUpWithSocial,
	} = useSignUpContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				{/* Sign-up is by invitation: organization invitees arrive with
				    their email; anyone else is told so. */}
				{lockedEmail ? (
					<SignUpForm
						onSignUp={signUpWithPassword}
						onSocialSignUp={signUpWithSocial}
						isSubmitting={isSubmitting}
						error={error}
						verificationSentTo={verificationSentTo}
						lockedEmail={lockedEmail}
						authSearch={authSearch}
					/>
				) : (
					<Card>
						<CardHeader>
							<CardTitle>{m.sign_up_invite_only_title()}</CardTitle>
							<CardDescription>{m.sign_up_invite_only()}</CardDescription>
						</CardHeader>
						<CardContent>
							<Button className="w-full" render={<Link to="/sign-in" />}>
								{m.sign_up_sign_in()}
							</Button>
						</CardContent>
					</Card>
				)}
				<LocaleSwitcher />
			</div>
		</div>
	);
}

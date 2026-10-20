import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignUpForm } from "./components/sign-up-form";
import { useSignUpContext } from "./sign-up.context";

export function SignUpPage() {
	const {
		isSubmitting,
		error,
		verificationSentTo,
		lockedEmail,
		signUpWithPassword,
		signUpWithSocial,
	} = useSignUpContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<SignUpForm
					onSignUp={signUpWithPassword}
					onSocialSignUp={signUpWithSocial}
					isSubmitting={isSubmitting}
					error={error}
					verificationSentTo={verificationSentTo}
					lockedEmail={lockedEmail}
				/>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

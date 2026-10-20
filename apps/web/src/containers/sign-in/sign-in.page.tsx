import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignInForm } from "./components/sign-in-form";
import { useSignInContext } from "./sign-in.context";

export function SignInPage() {
	const {
		mode,
		setMode,
		isSubmitting,
		error,
		magicLinkSent,
		lockedEmail,
		signInWithPassword,
		signInWithMagicLink,
		signInWithSocial,
	} = useSignInContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<SignInForm
					mode={mode}
					onModeChange={setMode}
					onPasswordSignIn={signInWithPassword}
					onMagicLinkSignIn={signInWithMagicLink}
					onSocialSignIn={signInWithSocial}
					isSubmitting={isSubmitting}
					error={error}
					magicLinkSent={magicLinkSent}
					lockedEmail={lockedEmail}
				/>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

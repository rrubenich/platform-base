import { LocaleSwitcher } from "@/components/locale-switcher";
import { LoginForm } from "@/components/login-form";
import { useLoginContext } from "./login.context";

export function LoginPage() {
	const {
		mode,
		setMode,
		isSubmitting,
		error,
		magicLinkSent,
		signInWithPassword,
		signInWithMagicLink,
		signInWithGoogle,
	} = useLoginContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<LoginForm
					mode={mode}
					onModeChange={setMode}
					onPasswordSignIn={signInWithPassword}
					onMagicLinkSignIn={signInWithMagicLink}
					onGoogleSignIn={signInWithGoogle}
					isSubmitting={isSubmitting}
					error={error}
					magicLinkSent={magicLinkSent}
				/>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

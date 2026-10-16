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
			<div className="w-full max-w-sm md:max-w-3xl">
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
			</div>
		</div>
	);
}

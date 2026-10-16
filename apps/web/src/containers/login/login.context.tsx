import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { LoginMode } from "@/components/login-form";

type LoginContextValue = {
	mode: LoginMode;
	setMode: (mode: LoginMode) => void;
	isSubmitting: boolean;
	error: string | null;
	magicLinkSent: boolean;
	signInWithPassword: (values: { email: string; password: string }) => void;
	signInWithMagicLink: (values: { email: string }) => void;
	signInWithGoogle: () => void;
};

const LoginContext = createContext<LoginContextValue | undefined>(undefined);

export function LoginProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [mode, setModeState] = useState<LoginMode>("password");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [magicLinkSent, setMagicLinkSent] = useState(false);

	function setMode(nextMode: LoginMode) {
		setError(null);
		setMagicLinkSent(false);
		setModeState(nextMode);
	}

	async function signInWithPassword(values: {
		email: string;
		password: string;
	}) {
		setIsSubmitting(true);
		setError(null);

		const { error: signInError } = await authClient.signIn.email({
			email: values.email,
			password: values.password,
			callbackURL: "/",
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(signInError.message ?? "Could not sign in. Please try again.");
			return;
		}

		navigate({ to: "/" });
	}

	async function signInWithMagicLink(values: { email: string }) {
		setIsSubmitting(true);
		setError(null);
		setMagicLinkSent(false);

		const { error: signInError } = await authClient.signIn.magicLink({
			email: values.email,
			callbackURL: "/",
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(
				signInError.message ??
					"Could not send the magic link. Please try again.",
			);
			return;
		}

		setMagicLinkSent(true);
	}

	async function signInWithGoogle() {
		setIsSubmitting(true);
		setError(null);

		const { error: signInError } = await authClient.signIn.social({
			provider: "google",
			callbackURL: "/",
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(
				signInError.message ??
					"Could not sign in with Google. Please try again.",
			);
		}
	}

	const value: LoginContextValue = {
		mode,
		setMode,
		isSubmitting,
		error,
		magicLinkSent,
		signInWithPassword,
		signInWithMagicLink,
		signInWithGoogle,
	};

	return (
		<LoginContext.Provider value={value}>{children}</LoginContext.Provider>
	);
}

export function useLoginContext() {
	const context = useContext(LoginContext);

	if (context === undefined) {
		throw new Error("useLoginContext must be used within a LoginProvider");
	}

	return context;
}

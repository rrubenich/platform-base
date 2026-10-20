import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import {
	type SocialProvider,
	socialProviderName,
} from "@/components/social-sign-on";
import { appURL } from "@/lib/app-url";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import type { SignInMode } from "./components/sign-in-form";

type SignInContextValue = {
	mode: SignInMode;
	setMode: (mode: SignInMode) => void;
	isSubmitting: boolean;
	error: string | null;
	magicLinkSent: boolean;
	signInWithPassword: (values: { email: string; password: string }) => void;
	signInWithMagicLink: (values: { email: string }) => void;
	signInWithSocial: (provider: SocialProvider) => void;
};

const SignInContext = createContext<SignInContextValue | undefined>(undefined);

export function SignInProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [mode, setModeState] = useState<SignInMode>("password");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [magicLinkSent, setMagicLinkSent] = useState(false);

	function setMode(nextMode: SignInMode) {
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

		const { data, error: signInError } = await authClient.signIn.email({
			email: values.email,
			password: values.password,
			callbackURL: appURL("/"),
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(authErrorMessage(signInError, m.sign_in_error_password()));
			return;
		}

		// With 2FA on, no session exists yet: the server set a short-lived
		// two-factor cookie and expects a code on /two-factor first.
		if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
			navigate({ to: "/two-factor" });
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
			callbackURL: appURL("/"),
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(authErrorMessage(signInError, m.sign_in_error_magic_link()));
			return;
		}

		setMagicLinkSent(true);
	}

	async function signInWithSocial(provider: SocialProvider) {
		setIsSubmitting(true);
		setError(null);

		const { error: signInError } = await authClient.signIn.social({
			provider,
			callbackURL: appURL("/"),
		});

		setIsSubmitting(false);

		if (signInError) {
			setError(
				authErrorMessage(
					signInError,
					m.sign_in_error_social({ provider: socialProviderName(provider) }),
				),
			);
		}
	}

	const value: SignInContextValue = {
		mode,
		setMode,
		isSubmitting,
		error,
		magicLinkSent,
		signInWithPassword,
		signInWithMagicLink,
		signInWithSocial,
	};

	return (
		<SignInContext.Provider value={value}>{children}</SignInContext.Provider>
	);
}

export function useSignInContext() {
	const context = useContext(SignInContext);

	if (context === undefined) {
		throw new Error("useSignInContext must be used within a SignInProvider");
	}

	return context;
}

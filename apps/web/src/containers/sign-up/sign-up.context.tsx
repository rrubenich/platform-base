import { m } from "@workspace/i18n/messages";
import { getLocale } from "@workspace/i18n/runtime";
import { createContext, type ReactNode, useContext, useState } from "react";
import {
	type SocialProvider,
	socialProviderName,
} from "@/components/social-sign-on";
import { appURL } from "@/lib/app-url";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import type { SignUpValues } from "./components/sign-up-form";

type SignUpContextValue = {
	isSubmitting: boolean;
	error: string | null;
	verificationSentTo: string | null;
	signUpWithPassword: (values: SignUpValues) => void;
	signUpWithSocial: (provider: SocialProvider) => void;
};

const SignUpContext = createContext<SignUpContextValue | undefined>(undefined);

export function SignUpProvider({ children }: { children: ReactNode }) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [verificationSentTo, setVerificationSentTo] = useState<string | null>(
		null,
	);

	async function signUpWithPassword(values: SignUpValues) {
		setIsSubmitting(true);
		setError(null);

		// Email verification is required (see apps/api/src/lib/auth.ts), so no
		// session is created here: the verification link signs the user in and
		// lands them on `callbackURL`.
		const { error: signUpError } = await authClient.signUp.email({
			name: values.name,
			email: values.email,
			password: values.password,
			locale: getLocale(),
			callbackURL: appURL("/"),
		});

		setIsSubmitting(false);

		if (signUpError) {
			setError(authErrorMessage(signUpError, m.sign_up_error()));
			return;
		}

		setVerificationSentTo(values.email);
	}

	async function signUpWithSocial(provider: SocialProvider) {
		setIsSubmitting(true);
		setError(null);

		const { error: signUpError } = await authClient.signIn.social({
			provider,
			callbackURL: appURL("/"),
		});

		setIsSubmitting(false);

		if (signUpError) {
			setError(
				authErrorMessage(
					signUpError,
					m.sign_up_error_social({ provider: socialProviderName(provider) }),
				),
			);
		}
	}

	const value: SignUpContextValue = {
		isSubmitting,
		error,
		verificationSentTo,
		signUpWithPassword,
		signUpWithSocial,
	};

	return (
		<SignUpContext.Provider value={value}>{children}</SignUpContext.Provider>
	);
}

export function useSignUpContext() {
	const context = useContext(SignUpContext);

	if (context === undefined) {
		throw new Error("useSignUpContext must be used within a SignUpProvider");
	}

	return context;
}

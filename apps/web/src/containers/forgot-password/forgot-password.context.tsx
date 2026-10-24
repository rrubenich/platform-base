import { useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { appURL } from "@/lib/app-url";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import type { AuthSearch } from "@/lib/redirect-target";

type ForgotPasswordContextValue = {
	/** Prefills the email (from the sign-in page). */
	initialEmail: string | undefined;
	/** Kept on the link back to sign-in. */
	authSearch: AuthSearch;
	isSubmitting: boolean;
	error: string | null;
	/** The address a link was requested for; null until then. */
	sentTo: string | null;
	requestLink: (email: string) => Promise<void>;
};

const ForgotPasswordContext = createContext<
	ForgotPasswordContextValue | undefined
>(undefined);

export function ForgotPasswordProvider({ children }: { children: ReactNode }) {
	const authSearch = useSearch({ from: "/(auth)/forgot-password" });
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);

	async function requestLink(email: string) {
		setSubmitting(true);
		setError(null);
		// Answers the same whether or not the email has an account, so the
		// page can't be used to find out who is signed up.
		const { error: requestError } = await authClient.requestPasswordReset({
			email,
			redirectTo: appURL("/reset-password"),
		});
		setSubmitting(false);
		if (requestError) {
			setError(authErrorMessage(requestError, m.forgot_password_error()));
			return;
		}
		setSentTo(email);
	}

	return (
		<ForgotPasswordContext.Provider
			value={{
				initialEmail: authSearch.email,
				authSearch,
				isSubmitting,
				error,
				sentTo,
				requestLink,
			}}
		>
			{children}
		</ForgotPasswordContext.Provider>
	);
}

export function useForgotPasswordContext() {
	const context = useContext(ForgotPasswordContext);

	if (context === undefined) {
		throw new Error(
			"useForgotPasswordContext must be used within a ForgotPasswordProvider",
		);
	}

	return context;
}

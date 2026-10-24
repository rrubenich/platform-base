import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

const INVALID_TOKEN = "INVALID_TOKEN";

type ResetPasswordContextValue = {
	/** "form" to choose the password, "done" after, "invalid" for a bad link. */
	step: "form" | "done" | "invalid";
	isSubmitting: boolean;
	error: string | null;
	reset: (newPassword: string) => Promise<void>;
};

const ResetPasswordContext = createContext<
	ResetPasswordContextValue | undefined
>(undefined);

// The emailed link goes through the API, which checks the token and sends
// the browser here with `?token=` (or `?error=INVALID_TOKEN`).
export function ResetPasswordProvider({ children }: { children: ReactNode }) {
	const { token, error: linkError } = useSearch({
		from: "/(auth)/reset-password",
	});
	const queryClient = useQueryClient();
	const [step, setStep] = useState<ResetPasswordContextValue["step"]>(
		token && !linkError ? "form" : "invalid",
	);
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function reset(newPassword: string) {
		if (!token) return;
		setSubmitting(true);
		setError(null);
		const { error: resetError } = await authClient.resetPassword({
			newPassword,
			token,
		});
		setSubmitting(false);
		if (resetError) {
			// Used or expired since the link was opened.
			if (resetError.code === INVALID_TOKEN) setStep("invalid");
			else setError(authErrorMessage(resetError, m.reset_password_error()));
			return;
		}
		// Every session was revoked: forget whatever was cached for it.
		queryClient.clear();
		setStep("done");
	}

	return (
		<ResetPasswordContext.Provider value={{ step, isSubmitting, error, reset }}>
			{children}
		</ResetPasswordContext.Provider>
	);
}

export function useResetPasswordContext() {
	const context = useContext(ResetPasswordContext);

	if (context === undefined) {
		throw new Error(
			"useResetPasswordContext must be used within a ResetPasswordProvider",
		);
	}

	return context;
}

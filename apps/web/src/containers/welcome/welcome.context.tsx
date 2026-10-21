import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { accountInvitationsApi } from "@/lib/account-invitations-api";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useSignOut } from "@/lib/sign-out";

export type WelcomeState =
	| "loading"
	| "ready"
	| "invalid"
	| "expired"
	| "accepted"
	| "error";

export type WelcomeValues = { name: string; password: string };

type WelcomeContextValue = {
	state: WelcomeState;
	preview: { email: string; organizationName: string } | undefined;
	/** The email of whoever is signed in on this browser, if anyone. */
	signedInEmail: string | undefined;
	/** Resolves to an error message, or null once signed in. */
	accept: (values: WelcomeValues) => Promise<string | null>;
	signOut: () => Promise<void>;
};

const WelcomeContext = createContext<WelcomeContextValue | undefined>(
	undefined,
);

function stateOf(error: unknown): WelcomeState {
	if (!(error instanceof ApiError)) return "error";
	if (error.status === 404) return "invalid";
	if (error.code === "INVITATION_EXPIRED") return "expired";
	if (error.code === "INVITATION_ACCEPTED") return "accepted";
	return "error";
}

export function WelcomeProvider({ children }: { children: ReactNode }) {
	const { token } = useParams({ from: "/welcome/$token" });
	const navigate = useNavigate();
	const session = authClient.useSession();
	const signOut = useSignOut();

	const preview = useQuery({
		queryKey: ["account-invitation", token],
		queryFn: () => accountInvitationsApi.preview(token),
		retry: false,
	});

	const state: WelcomeState = preview.isPending
		? "loading"
		: preview.isError
			? stateOf(preview.error)
			: "ready";

	const value: WelcomeContextValue = {
		state,
		preview: preview.data,
		signedInEmail: session.data?.user.email,
		accept: async ({ name, password }) => {
			let email: string;
			try {
				({ email } = await accountInvitationsApi.accept(token, {
					name,
					password,
				}));
			} catch (error) {
				const next = stateOf(error);
				if (next === "expired") return m.welcome_expired();
				if (next === "accepted") return m.welcome_accepted();
				return error instanceof ApiError && error.status === 400
					? error.message
					: m.welcome_error();
			}
			const { error } = await authClient.signIn.email({ email, password });
			// The login is set up either way; signing in again is all that's left.
			await navigate(error ? { to: "/sign-in" } : { to: "/" });
			return null;
		},
		signOut: async () => {
			await signOut();
		},
	};

	return (
		<WelcomeContext.Provider value={value}>{children}</WelcomeContext.Provider>
	);
}

export function useWelcomeContext() {
	const context = useContext(WelcomeContext);

	if (context === undefined) {
		throw new Error("useWelcomeContext must be used within a WelcomeProvider");
	}

	return context;
}

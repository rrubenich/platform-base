import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { toast } from "sonner";
import { appURL } from "@/lib/app-url";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

const SESSIONS_QUERY_KEY = ["account", "sessions"] as const;

export type AccountUser = {
	name: string;
	email: string;
	image?: string | null;
};

export type AccountSession = {
	id: string;
	token: string;
	userAgent?: string | null;
	ipAddress?: string | null;
	createdAt: Date | string;
	isCurrent: boolean;
};

type AuthResult = {
	error?: { message?: string; status?: number } | null;
};

type AccountContextValue = {
	isLoading: boolean;
	user: AccountUser | undefined;
	/** Signs in with a password (not only social accounts or email links). */
	hasPassword: boolean;
	/** The user's sessions, the current one first; undefined while loading. */
	sessions: AccountSession[] | undefined;
	isSessionsError: boolean;
	/** Every action resolves to an error message, or null on success. */
	saveName: (name: string) => Promise<string | null>;
	changeEmail: (newEmail: string) => Promise<string | null>;
	changePassword: (values: {
		currentPassword: string;
		newPassword: string;
		revokeOtherSessions: boolean;
	}) => Promise<string | null>;
	/** Emails a link to set a first password (accounts without one). */
	sendSetPasswordLink: () => Promise<string | null>;
	revokeSession: (token: string) => Promise<string | null>;
	revokeOtherSessions: () => Promise<string | null>;
	deleteAccount: (password: string | undefined) => Promise<string | null>;
};

const AccountContext = createContext<AccountContextValue | undefined>(
	undefined,
);

/** The signed-in user's own account: profile, email, password, sessions. */
export function AccountProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const {
		data: session,
		isPending: isSessionPending,
		refetch: refetchSession,
	} = authClient.useSession();
	// Deleting the account ends the session too: don't send them to sign-in
	// over the top of the redirect the deletion already made.
	const [isDeleted, setDeleted] = useState(false);

	useEffect(() => {
		if (!isSessionPending && !session && !isDeleted) {
			void navigate({ to: "/sign-in" });
		}
	}, [isSessionPending, session, isDeleted, navigate]);

	const userId = session?.user.id;
	const currentToken = session?.session.token;

	const { data: accounts, isLoading: isAccountsLoading } = useQuery({
		queryKey: ["accounts", userId],
		queryFn: async () => {
			const { data, error } = await authClient.listAccounts();
			if (error) throw error;
			return data;
		},
		enabled: Boolean(userId),
	});

	const { data: sessions, isError: isSessionsError } = useQuery({
		queryKey: [...SESSIONS_QUERY_KEY, userId],
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();
			if (error) throw error;
			return data ?? [];
		},
		enabled: Boolean(userId),
		select: (list): AccountSession[] =>
			list
				.map((item) => ({ ...item, isCurrent: item.token === currentToken }))
				.sort(
					(a, b) =>
						Number(b.isCurrent) - Number(a.isCurrent) ||
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				),
	});

	/** Runs a request; toasts `success` and resolves to null, or to the error. */
	async function run(
		request: () => Promise<AuthResult>,
		fallback: string,
		success?: string,
	): Promise<string | null> {
		const { error } = await request();
		if (error) return authErrorMessage(error, fallback);
		if (success) toast.success(success);
		return null;
	}

	const refreshSessions = () =>
		queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });

	const value: AccountContextValue = {
		isLoading: isSessionPending || isAccountsLoading,
		user: session?.user,
		hasPassword: Boolean(
			accounts?.some(({ providerId }) => providerId === "credential"),
		),
		sessions,
		isSessionsError,
		saveName: async (name) => {
			const failure = await run(
				() => authClient.updateUser({ name }),
				m.account_profile_error(),
				m.account_toast_profile_saved(),
			);
			if (!failure) await refetchSession();
			return failure;
		},
		changeEmail: (newEmail) =>
			run(
				() =>
					authClient.changeEmail({
						newEmail,
						callbackURL: appURL("/settings/account"),
					}),
				m.account_email_error(),
			),
		changePassword: async (values) => {
			const failure = await run(
				() => authClient.changePassword(values),
				m.account_password_error(),
				m.account_toast_password_changed(),
			);
			if (!failure) await refreshSessions();
			return failure;
		},
		sendSetPasswordLink: () =>
			run(
				() =>
					authClient.requestPasswordReset({
						email: session?.user.email ?? "",
						redirectTo: appURL("/reset-password"),
					}),
				m.forgot_password_error(),
			),
		revokeSession: async (token) => {
			const failure = await run(
				() => authClient.revokeSession({ token }),
				m.account_sessions_action_error(),
				m.account_toast_session_revoked(),
			);
			await refreshSessions();
			return failure;
		},
		revokeOtherSessions: async () => {
			const failure = await run(
				() => authClient.revokeOtherSessions(),
				m.account_sessions_action_error(),
				m.account_toast_sessions_revoked(),
			);
			await refreshSessions();
			return failure;
		},
		deleteAccount: async (password) => {
			setDeleted(true);
			const failure = await run(
				() => authClient.deleteUser(password ? { password } : {}),
				m.account_delete_error(),
			);
			if (failure) {
				setDeleted(false);
				return failure;
			}
			queryClient.clear();
			await navigate({ to: "/sign-in" });
			return null;
		},
	};

	return (
		<AccountContext.Provider value={value}>{children}</AccountContext.Provider>
	);
}

export function useAccountContext() {
	const context = useContext(AccountContext);

	if (context === undefined) {
		throw new Error("useAccountContext must be used within an AccountProvider");
	}

	return context;
}

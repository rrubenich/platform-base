import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

/** What a password confirmation unlocks. */
export type PasswordAction = "enable" | "disable" | "regenerate";

export type SecurityView =
	| { step: "overview" }
	| { step: "confirm-password"; action: PasswordAction }
	// 2FA isn't on until the first code from the authenticator app verifies.
	| { step: "verify-totp"; totpURI: string; backupCodes: string[] }
	| { step: "backup-codes"; backupCodes: string[] };

type SecurityContextValue = {
	isLoading: boolean;
	twoFactorEnabled: boolean;
	/** 2FA needs a credential account: it only guards password sign-in. */
	hasPassword: boolean;
	view: SecurityView;
	isSubmitting: boolean;
	error: string | null;
	requestPassword: (action: PasswordAction) => void;
	confirmPassword: (values: { password: string }) => void;
	verifyTotp: (values: { code: string }) => void;
	backToOverview: () => void;
};

const SecurityContext = createContext<SecurityContextValue | undefined>(
	undefined,
);

export function SecurityProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [view, setView] = useState<SecurityView>({ step: "overview" });
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isSessionPending && !session) navigate({ to: "/sign-in" });
	}, [isSessionPending, session, navigate]);

	const userId = session?.user.id;
	const { data: accounts, isLoading: isAccountsLoading } = useQuery({
		queryKey: ["accounts", userId],
		queryFn: async () => {
			const { data, error: listError } = await authClient.listAccounts();
			if (listError) throw listError;
			return data;
		},
		enabled: Boolean(userId),
	});

	function goTo(nextView: SecurityView) {
		setError(null);
		setView(nextView);
	}

	async function run<T>(
		request: Promise<{ data: T | null; error: { message?: string } | null }>,
		onSuccess: (data: T) => void,
	) {
		setIsSubmitting(true);
		setError(null);

		const { data, error: requestError } = await request;

		setIsSubmitting(false);

		if (requestError || !data) {
			setError(authErrorMessage(requestError ?? {}, m.security_error()));
			return;
		}

		onSuccess(data);
	}

	function confirmPassword({ password }: { password: string }) {
		if (view.step !== "confirm-password") return;

		switch (view.action) {
			case "enable":
				// Authenticator-app setup; emailed codes then work as a fallback
				// at sign-in without any setup of their own.
				return run(
					authClient.twoFactor.enable({ password, method: "totp" }),
					(data) => {
						if (data.method !== "totp") return;
						goTo({
							step: "verify-totp",
							totpURI: data.totpURI,
							backupCodes: data.backupCodes,
						});
					},
				);
			case "disable":
				return run(authClient.twoFactor.disable({ password }), () =>
					goTo({ step: "overview" }),
				);
			case "regenerate":
				return run(
					authClient.twoFactor.generateBackupCodes({ password }),
					(data) =>
						goTo({ step: "backup-codes", backupCodes: data.backupCodes }),
				);
		}
	}

	function verifyTotp({ code }: { code: string }) {
		if (view.step !== "verify-totp") return;
		const { backupCodes } = view;

		return run(authClient.twoFactor.verifyTotp({ code }), () =>
			goTo({ step: "backup-codes", backupCodes }),
		);
	}

	const value: SecurityContextValue = {
		isLoading: isSessionPending || isAccountsLoading,
		twoFactorEnabled: Boolean(session?.user.twoFactorEnabled),
		hasPassword: Boolean(
			accounts?.some(({ providerId }) => providerId === "credential"),
		),
		view,
		isSubmitting,
		error,
		requestPassword: (action) => goTo({ step: "confirm-password", action }),
		confirmPassword,
		verifyTotp,
		backToOverview: () => goTo({ step: "overview" }),
	};

	return (
		<SecurityContext.Provider value={value}>
			{children}
		</SecurityContext.Provider>
	);
}

export function useSecurityContext() {
	const context = useContext(SecurityContext);

	if (context === undefined) {
		throw new Error(
			"useSecurityContext must be used within a SecurityProvider",
		);
	}

	return context;
}

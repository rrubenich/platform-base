import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import { ORGANIZATION_QUERY_KEY } from "@/lib/organization";
import type { AuthSearch } from "@/lib/redirect-target";
import { useSignOut } from "@/lib/sign-out";

export type InvitationDetails = {
	organizationName: string;
	inviterEmail: string;
	role: string;
};

export type InvitationView =
	| { kind: "loading" }
	| { kind: "signed-out" }
	| { kind: "wrong-account"; currentEmail: string }
	| { kind: "invalid" }
	| { kind: "unverified" }
	| { kind: "error"; message: string }
	| { kind: "ready"; invitation: InvitationDetails }
	| { kind: "declined"; organizationName: string | null };

type InvitationContextValue = {
	view: InvitationView;
	/** The address from the link, if it carried one. */
	email: string | undefined;
	/** Search for the sign-in / sign-up links: back to this page, email locked. */
	authSearch: AuthSearch;
	pending: "accept" | "reject" | "switch" | null;
	/** Message from the last failed accept / reject / sign out. */
	actionError: string | null;
	accept: () => Promise<void>;
	reject: () => Promise<void>;
	switchAccount: () => Promise<void>;
	/** Loads the invitation again after a failure. */
	retry: () => void;
};

const InvitationContext = createContext<InvitationContextValue | undefined>(
	undefined,
);

// getInvitation answers a missing, non-pending or expired invitation with a
// bare 400 ("Invitation not found!") that carries no code; the recipient check
// and accept/reject use these codes.
const UNAVAILABLE_CODES = [
	"INVITATION_NOT_FOUND",
	"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
];
const UNVERIFIED_CODE = "EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION";

const sameEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function InvitationProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const signOut = useSignOut();
	const queryClient = useQueryClient();
	const { invitationId } = useParams({ from: "/invitations/$invitationId" });
	const { email } = useSearch({ from: "/invitations/$invitationId" });
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [pending, setPending] =
		useState<InvitationContextValue["pending"]>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [declined, setDeclined] = useState<{ name: string | null } | null>(
		null,
	);

	const sessionEmail = session?.user.email;
	const wrongAccount =
		sessionEmail !== undefined &&
		email !== undefined &&
		!sameEmail(sessionEmail, email);

	const invitationQuery = useQuery({
		queryKey: ["invitation", invitationId, sessionEmail],
		enabled: sessionEmail !== undefined && !wrongAccount,
		retry: false,
		queryFn: async () => {
			const { data, error } = await authClient.organization.getInvitation({
				query: { id: invitationId },
			});
			if (error || !data) {
				const code = error?.code ?? "";
				if (
					UNAVAILABLE_CODES.includes(code) ||
					(error?.status === 400 && !code)
				) {
					return { kind: "unavailable" as const };
				}
				if (code === UNVERIFIED_CODE) return { kind: "unverified" as const };
				return {
					kind: "failed" as const,
					message: error
						? authErrorMessage(error, m.invitation_load_error())
						: m.invitation_load_error(),
				};
			}
			return {
				kind: "ready" as const,
				invitation: {
					organizationName: data.organizationName,
					inviterEmail: data.inviterEmail,
					role: data.role,
				} satisfies InvitationDetails,
			};
		},
	});

	const path = `/invitations/${invitationId}${
		email ? `?email=${encodeURIComponent(email)}` : ""
	}`;
	const authSearch: AuthSearch = email
		? { redirect: path, email }
		: { redirect: path };

	let view: InvitationView;
	const result = invitationQuery.data;
	if (declined !== null) {
		view = { kind: "declined", organizationName: declined.name };
	} else if (isSessionPending) {
		view = { kind: "loading" };
	} else if (!session) {
		view = { kind: "signed-out" };
	} else if (wrongAccount) {
		view = { kind: "wrong-account", currentEmail: session.user.email };
	} else if (invitationQuery.isError) {
		view = { kind: "error", message: m.invitation_load_error() };
	} else if (!result) {
		view = { kind: "loading" };
	} else if (result.kind === "ready") {
		view = { kind: "ready", invitation: result.invitation };
	} else if (result.kind === "unavailable") {
		view = { kind: "invalid" };
	} else if (result.kind === "unverified") {
		view = { kind: "unverified" };
	} else {
		view = { kind: "error", message: result.message };
	}

	async function accept() {
		setPending("accept");
		setActionError(null);
		const { error } = await authClient.organization.acceptInvitation({
			invitationId,
		});
		setPending(null);
		if (error) {
			setActionError(authErrorMessage(error, m.invitation_accept_error()));
			return;
		}
		await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		navigate({ to: "/" });
	}

	async function reject() {
		setPending("reject");
		setActionError(null);
		const { error } = await authClient.organization.rejectInvitation({
			invitationId,
		});
		setPending(null);
		if (error) {
			setActionError(authErrorMessage(error, m.invitation_reject_error()));
			return;
		}
		setDeclined({
			name: view.kind === "ready" ? view.invitation.organizationName : null,
		});
	}

	async function switchAccount() {
		setPending("switch");
		setActionError(null);
		const { error } = await signOut();
		setPending(null);
		if (error) {
			setActionError(authErrorMessage(error, m.invitation_sign_out_error()));
			return;
		}
		navigate({ to: "/sign-in", search: authSearch });
	}

	const value: InvitationContextValue = {
		view,
		email,
		authSearch,
		pending,
		actionError,
		accept,
		reject,
		switchAccount,
		retry: () => void invitationQuery.refetch(),
	};

	return (
		<InvitationContext.Provider value={value}>
			{children}
		</InvitationContext.Provider>
	);
}

export function useInvitationContext() {
	const context = useContext(InvitationContext);

	if (context === undefined) {
		throw new Error(
			"useInvitationContext must be used within an InvitationProvider",
		);
	}

	return context;
}

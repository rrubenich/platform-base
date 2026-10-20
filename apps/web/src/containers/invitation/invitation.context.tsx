import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import { ORGANIZATION_QUERY_KEY } from "@/lib/organization";
import type { AuthSearch } from "@/lib/redirect-target";

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
	| { kind: "error"; message: string }
	| { kind: "ready"; invitation: InvitationDetails }
	| { kind: "declined"; organizationName: string };

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
};

const InvitationContext = createContext<InvitationContextValue | undefined>(
	undefined,
);

// The plugin answers these when the invitation can't be used by this session.
const UNAVAILABLE_CODES = [
	"INVITATION_NOT_FOUND",
	"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
];

const sameEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function InvitationProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { invitationId } = useParams({ from: "/invitations/$invitationId" });
	const { email } = useSearch({ from: "/invitations/$invitationId" });
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [pending, setPending] =
		useState<InvitationContextValue["pending"]>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [declinedOrganization, setDeclinedOrganization] = useState<
		string | null
	>(null);

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
				return {
					ok: false as const,
					unavailable: UNAVAILABLE_CODES.includes(error?.code ?? ""),
					message: error
						? authErrorMessage(error, m.invitation_load_error())
						: m.invitation_load_error(),
				};
			}
			return {
				ok: true as const,
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
	if (declinedOrganization !== null) {
		view = { kind: "declined", organizationName: declinedOrganization };
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
	} else if (result.ok) {
		view = { kind: "ready", invitation: result.invitation };
	} else if (result.unavailable) {
		view = { kind: "invalid" };
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
		setDeclinedOrganization(
			view.kind === "ready" ? view.invitation.organizationName : "",
		);
	}

	async function switchAccount() {
		setPending("switch");
		setActionError(null);
		const { error } = await authClient.signOut();
		setPending(null);
		if (error) {
			setActionError(authErrorMessage(error, m.invitation_load_error()));
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

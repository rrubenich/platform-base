import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import {
	isPendingInvitation,
	ORGANIZATION_QUERY_KEY,
} from "@/lib/organization";
import { useSignOut } from "@/lib/sign-out";

export type PendingInvitation = {
	id: string;
	organizationName: string;
	role: string;
};

type OnboardingContextValue = {
	invitations: PendingInvitation[];
	/** Still loading the pending invitations. */
	invitationsLoading: boolean;
	/** Loading the pending invitations failed. */
	invitationsError: boolean;
	/** Id of the invitation being accepted, if any. */
	acceptingId: string | null;
	accept: (invitationId: string) => Promise<void>;
	signingOut: boolean;
	signOut: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
	undefined,
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const signOutAndForget = useSignOut();
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [signingOut, setSigningOut] = useState(false);

	const {
		data: invitations = [],
		isPending: invitationsLoading,
		isError: invitationsError,
	} = useQuery({
		queryKey: ["user-invitations"],
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.listUserInvitations();
			if (error) throw new Error(error.message);
			return (data ?? [])
				.filter((invitation) => isPendingInvitation(invitation))
				.map(
					(invitation): PendingInvitation => ({
						id: invitation.id,
						organizationName: invitation.organizationName ?? "",
						role: invitation.role,
					}),
				);
		},
	});

	async function enter() {
		await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		navigate({ to: "/" });
	}

	async function accept(invitationId: string) {
		setAcceptingId(invitationId);
		const { error } = await authClient.organization.acceptInvitation({
			invitationId,
		});
		setAcceptingId(null);
		if (error) {
			toast.error(authErrorMessage(error, m.onboarding_accept_error()));
			return;
		}
		await enter();
	}

	async function signOut() {
		setSigningOut(true);
		const { error } = await signOutAndForget();
		setSigningOut(false);
		if (error) {
			toast.error(authErrorMessage(error, m.onboarding_sign_out_error()));
			return;
		}
		navigate({ to: "/sign-in" });
	}

	const value: OnboardingContextValue = {
		invitations,
		invitationsLoading,
		invitationsError,
		acceptingId,
		accept,
		signingOut,
		signOut,
	};

	return (
		<OnboardingContext.Provider value={value}>
			{children}
		</OnboardingContext.Provider>
	);
}

export function useOnboardingContext() {
	const context = useContext(OnboardingContext);

	if (context === undefined) {
		throw new Error(
			"useOnboardingContext must be used within an OnboardingProvider",
		);
	}

	return context;
}

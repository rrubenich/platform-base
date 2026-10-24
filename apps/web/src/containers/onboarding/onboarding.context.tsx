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
	/** Loading the pending invitations failed. */
	invitationsError: boolean;
	/** Id of the invitation being accepted, if any. */
	acceptingId: string | null;
	/** Resolves to an error message, or null once created. */
	createOrganization: (values: {
		name: string;
		slug: string;
	}) => Promise<string | null>;
	/** Tells the context which slug the form currently holds. */
	setSlug: (slug: string) => void;
	/** Whether that slug is taken, checked 300 ms after it settles; undefined while unknown. */
	slugTaken: boolean | undefined;
	accept: (invitationId: string) => Promise<void>;
	signingOut: boolean;
	signOut: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
	undefined,
);

const SLUG_DEBOUNCE_MS = 300;

function useSlugTaken(slug: string): boolean | undefined {
	const [debounced, setDebounced] = useState(slug);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(slug), SLUG_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [slug]);

	const { data } = useQuery({
		queryKey: ["organization-slug", debounced],
		enabled: debounced !== "",
		queryFn: async () => {
			const { data: result, error } = await authClient.organization.checkSlug({
				slug: debounced,
			});
			if (error) {
				return error.code === "SLUG_IS_TAKEN" ? true : undefined;
			}
			return result?.status === false;
		},
	});

	if (slug === "" || debounced !== slug) return undefined;
	return data;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const signOutAndForget = useSignOut();
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [signingOut, setSigningOut] = useState(false);
	const [slug, setSlug] = useState("");
	const slugTaken = useSlugTaken(slug);

	const { data: invitations = [], isError: invitationsError } = useQuery({
		queryKey: ["user-invitations"],
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.listUserInvitations();
			if (error) throw new Error(error.message);
			return (data ?? [])
				.filter((invitation) => isPendingInvitation(invitation))
				.map((invitation): PendingInvitation => ({
					id: invitation.id,
					organizationName: invitation.organizationName ?? "",
					role: invitation.role,
				}));
		},
	});

	async function enter() {
		await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		void navigate({ to: "/" });
	}

	async function createOrganization(values: { name: string; slug: string }) {
		const { error } = await authClient.organization.create(values);
		if (error) return authErrorMessage(error, m.onboarding_create_error());
		await enter();
		return null;
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
		void navigate({ to: "/sign-in" });
	}

	const value: OnboardingContextValue = {
		invitations,
		invitationsError,
		acceptingId,
		createOrganization,
		setSlug,
		slugTaken,
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

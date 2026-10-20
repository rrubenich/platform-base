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
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import {
	ORGANIZATION_QUERY_KEY,
	type OrganizationDetails,
	type OrganizationMember,
	type OrgRole,
} from "@/lib/organization";
import { useOrganizationAction } from "@/lib/use-organization-action";

const ONLY_OWNER_CODE = "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER";
const SLUG_DEBOUNCE_MS = 300;

type OrganizationSettingsContextValue = {
	organization: OrganizationDetails | undefined;
	isLoading: boolean;
	viewerRole: OrgRole | undefined;
	can: (permissions: Record<string, string[]>) => boolean;
	/** Other members, who the viewer could hand ownership to. */
	otherMembers: OrganizationMember[];
	isPending: boolean;
	/** Tells the context which slug the form currently holds. */
	setSlug: (slug: string) => void;
	/** Whether that slug is taken by another organization; undefined while unknown. */
	slugTaken: boolean | undefined;
	/** Every action below resolves to an error message, or null on success. */
	save: (values: { name: string; slug: string }) => Promise<string | null>;
	transferOwnership: (memberId: string) => Promise<string | null>;
	leave: () => Promise<string | null>;
	deleteOrganization: () => Promise<string | null>;
};

const OrganizationSettingsContext = createContext<
	OrganizationSettingsContextValue | undefined
>(undefined);

function useSlugTaken(slug: string, currentSlug: string | undefined) {
	const [debounced, setDebounced] = useState(slug);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(slug), SLUG_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [slug]);

	const { data } = useQuery({
		queryKey: ["organization-slug", debounced],
		// The organization's own slug is always available to it.
		enabled: debounced !== "" && debounced !== currentSlug,
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

	if (slug === "" || slug === currentSlug || debounced !== slug)
		return undefined;
	return data;
}

export function OrganizationSettingsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { organization, isLoading, userId, role, can } = useWorkspace();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { submit, isPending } = useOrganizationAction();
	const details = organization as OrganizationDetails | undefined;

	const [slug, setSlug] = useState("");
	const slugTaken = useSlugTaken(slug, details?.slug);

	const ownMember = details?.members.find((member) => member.userId === userId);

	/** Leaving or deleting ends the membership: refresh, then go to onboarding. */
	async function exit() {
		await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		await navigate({ to: "/onboarding" });
	}

	const value: OrganizationSettingsContextValue = {
		organization: details,
		isLoading,
		viewerRole: role,
		can,
		otherMembers:
			details?.members.filter((member) => member.userId !== userId) ?? [],
		isPending,
		setSlug,
		slugTaken,
		save: (values) =>
			submit(() => authClient.organization.update({ data: values }), {
				success: m.org_settings_toast_saved(),
				fallback: m.org_settings_save_error(),
			}),
		transferOwnership: (memberId) =>
			submit(
				async () => {
					// Promote first: the other way round could leave no owner.
					const promoted = await authClient.organization.updateMemberRole({
						memberId,
						role: "owner",
					});
					if (promoted.error) return promoted;

					const demoted = ownMember
						? await authClient.organization.updateMemberRole({
								memberId: ownMember.id,
								role: "admin",
							})
						: { error: { message: undefined, status: undefined } };
					if (!demoted.error) return demoted;

					// Two owners now: refresh, and say exactly what happened.
					await queryClient.invalidateQueries({
						queryKey: ORGANIZATION_QUERY_KEY,
					});
					return {
						error: {
							message: m.org_settings_transfer_partial({
								name:
									details?.members.find(({ id }) => id === memberId)?.user
										.name ?? "",
							}),
							status: demoted.error.status,
						},
					};
				},
				{
					success: m.org_settings_toast_transferred(),
					fallback: m.org_settings_transfer_error(),
				},
			),
		leave: async () => {
			if (!details) return null;
			const failure = await submit(
				() => authClient.organization.leave({ organizationId: details.id }),
				{
					fallback: m.org_settings_leave_error(),
					codeMessages: {
						[ONLY_OWNER_CODE]: m.org_settings_leave_only_owner(),
					},
				},
			);
			if (!failure) await exit();
			return failure;
		},
		deleteOrganization: async () => {
			if (!details) return null;
			const failure = await submit(
				() => authClient.organization.delete({ organizationId: details.id }),
				{ fallback: m.org_settings_delete_error() },
			);
			if (!failure) await exit();
			return failure;
		},
	};

	return (
		<OrganizationSettingsContext.Provider value={value}>
			{children}
		</OrganizationSettingsContext.Provider>
	);
}

export function useOrganizationSettingsContext() {
	const context = useContext(OrganizationSettingsContext);

	if (context === undefined) {
		throw new Error(
			"useOrganizationSettingsContext must be used within an OrganizationSettingsProvider",
		);
	}

	return context;
}

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { authClient } from "@/lib/auth-client";
import { ORGANIZATION_QUERY_KEY } from "@/lib/organization";
import { useOrganizationAction } from "@/lib/use-organization-action";

const ONLY_OWNER_CODE = "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER";

/**
 * Leaves the organization and goes to onboarding. `leave` resolves to an
 * error message (the only owner is told to transfer first), or null.
 */
export function useLeaveOrganization(organizationId: string | undefined) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { submit, isPending } = useOrganizationAction();

	const leave = async () => {
		if (!organizationId) return null;
		const failure = await submit(
			() => authClient.organization.leave({ organizationId }),
			{
				fallback: m.org_settings_leave_error(),
				codeMessages: { [ONLY_OWNER_CODE]: m.org_settings_leave_only_owner() },
			},
		);
		if (!failure) {
			await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
			await navigate({ to: "/onboarding" });
		}
		return failure;
	};

	return { leave, isPending };
}

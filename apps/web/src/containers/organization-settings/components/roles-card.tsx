import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { memberRoleLabel } from "@/components/role-select";
import type { OrganizationDetails } from "@/lib/organization";

const ROLES = [
	{ role: "owner", description: m.org_settings_role_owner_description },
	{ role: "admin", description: m.org_settings_role_admin_description },
	{ role: "member", description: m.org_settings_role_member_description },
] as const;

/** What each role may do, and how many members hold it. */
export function RolesCard({
	organization,
}: {
	organization: OrganizationDetails;
}) {
	const holders = (role: string) =>
		organization.members.filter((member) => member.role === role).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.org_settings_roles_title()}</CardTitle>
				<CardDescription>{m.org_settings_roles_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="flex flex-col gap-4">
					{ROLES.map(({ role, description }) => (
						<div key={role} className="flex flex-col gap-1">
							<dt className="flex items-center gap-2 text-sm font-medium">
								{memberRoleLabel(role)}
								<Badge variant="secondary" className="tabular-nums">
									{holders(role)}
								</Badge>
							</dt>
							<dd className="text-sm text-muted-foreground">{description()}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

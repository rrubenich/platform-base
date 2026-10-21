import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import { formatNumber } from "@/lib/format";
import { useAdminOrganizationContext } from "./admin-organization.context";
import { InvitationsCard } from "./components/invitations-card";
import { MembersCard } from "./components/members-card";
import { OrganizationHeaderCard } from "./components/organization-header-card";
import { OwnerSetupCard } from "./components/owner-setup-card";
import { TeamsCard } from "./components/teams-card";

export function AdminOrganizationPage() {
	const { organization, isLoading, isError } = useAdminOrganizationContext();

	if (isError) {
		return (
			<div className="px-4 lg:px-6">
				<Alert variant="destructive">
					<AlertDescription>{m.admin_org_not_found()}</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (isLoading || !organization) {
		return (
			<div className="px-4 lg:px-6">
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<OrganizationHeaderCard
				key={`${organization.name}-${organization.slug}`}
				organization={organization}
			/>
			{organization.ownerSetup && (
				<OwnerSetupCard ownerSetup={organization.ownerSetup} />
			)}
			<Tabs defaultValue="members">
				<TabsList>
					<TabsTrigger value="members">
						{m.admin_members_tab({
							count: formatNumber(organization.members.length),
						})}
					</TabsTrigger>
					<TabsTrigger value="teams">
						{m.admin_teams_tab({
							count: formatNumber(organization.teams.length),
						})}
					</TabsTrigger>
					<TabsTrigger value="invitations">
						{m.admin_invitations_tab({
							count: formatNumber(organization.invitations.length),
						})}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="members">
					<MembersCard organization={organization} />
				</TabsContent>
				<TabsContent value="teams">
					<TeamsCard organization={organization} />
				</TabsContent>
				<TabsContent value="invitations">
					<InvitationsCard organization={organization} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

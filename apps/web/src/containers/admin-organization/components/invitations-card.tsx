import { m } from "@workspace/i18n/messages";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import type { OrganizationDetail } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { memberRoleLabel } from "@/components/role-select";

/** Pending invitations, read-only: members manage them inside the org. */
export function InvitationsCard({
	organization,
}: {
	organization: OrganizationDetail;
}) {
	const teamName = (teamId: string | null) =>
		organization.teams.find(({ id }) => id === teamId)?.name ?? "—";

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_invitations_title()}</CardTitle>
				<CardDescription>{m.admin_invitations_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{organization.invitations.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{m.admin_invitations_empty()}
					</p>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<Table>
							<TableHeader className="bg-muted">
								<TableRow>
									<TableHead>{m.admin_column_email()}</TableHead>
									<TableHead>{m.admin_column_role()}</TableHead>
									<TableHead className="hidden md:table-cell">
										{m.admin_column_team()}
									</TableHead>
									<TableHead className="hidden md:table-cell">
										{m.admin_column_expires()}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{organization.invitations.map((invitation) => (
									<TableRow key={invitation.id}>
										<TableCell>{invitation.email}</TableCell>
										<TableCell>
											{memberRoleLabel(invitation.role ?? "member")}
										</TableCell>
										<TableCell className="hidden md:table-cell">
											{teamName(invitation.teamId)}
										</TableCell>
										<TableCell className="hidden text-muted-foreground md:table-cell">
											{formatDateTime(invitation.expiresAt)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

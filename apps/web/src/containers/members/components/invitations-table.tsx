import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { memberRoleLabel } from "@/components/role-select";
import { formatDateTime } from "@/lib/format";
import { useMembersContext } from "../members.context";

/** Pending invitations only: accepted, rejected and expired ones are history. */
export function InvitationsTable() {
	const { organization, pendingInvitations, can, isPending, resend, cancel } =
		useMembersContext();
	const canResend = can({ invitation: ["create"] });
	const canCancel = can({ invitation: ["cancel"] });
	const showActions = canResend || canCancel;

	const invitations = pendingInvitations;
	const teamName = (teamId: string | null | undefined) =>
		organization?.teams?.find(({ id }) => id === teamId)?.name ?? "—";

	if (invitations.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />
					</EmptyMedia>
					<EmptyTitle>{m.members_invitations_empty_title()}</EmptyTitle>
					<EmptyDescription>
						{m.members_invitations_empty_description()}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader className="bg-muted">
					<TableRow>
						<TableHead>{m.members_column_email()}</TableHead>
						<TableHead>{m.members_column_role()}</TableHead>
						<TableHead className="hidden md:table-cell">
							{m.members_column_team()}
						</TableHead>
						<TableHead className="hidden md:table-cell">
							{m.members_column_expires()}
						</TableHead>
						{showActions && (
							<TableHead>
								<span className="sr-only">{m.members_column_actions()}</span>
							</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{invitations.map((invitation) => (
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
							{showActions && (
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										{canResend && (
											<Button
												variant="outline"
												size="sm"
												disabled={isPending}
												onClick={() => resend(invitation)}
											>
												{m.members_resend()}
											</Button>
										)}
										{canCancel && (
											<Button
												variant="ghost"
												size="sm"
												disabled={isPending}
												onClick={() => cancel(invitation.id)}
											>
												{m.members_cancel_invitation()}
											</Button>
										)}
									</div>
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Spinner } from "@workspace/ui/components/spinner";
import type { PendingInvitation } from "../onboarding.context";

function roleLabel(role: string): string {
	switch (role) {
		case "owner":
			return m.onboarding_role_owner();
		case "admin":
			return m.onboarding_role_admin();
		case "member":
			return m.onboarding_role_member();
		default:
			return role;
	}
}

export type PendingInvitationsProps = {
	invitations: PendingInvitation[];
	acceptingId: string | null;
	onAccept: (invitationId: string) => void;
};

export function PendingInvitations({
	invitations,
	acceptingId,
	onAccept,
}: PendingInvitationsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.onboarding_invitations_title()}</CardTitle>
				<CardDescription>
					{m.onboarding_invitations_description()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col gap-3">
					{invitations.map((invitation) => (
						<li
							key={invitation.id}
							className="flex items-center justify-between gap-3"
						>
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-medium">
									{invitation.organizationName}
								</span>
								<span className="text-sm text-muted-foreground">
									{roleLabel(invitation.role)}
								</span>
							</div>
							<Button
								disabled={acceptingId !== null}
								onClick={() => onAccept(invitation.id)}
							>
								{acceptingId === invitation.id && (
									<Spinner data-icon="inline-start" />
								)}
								{m.onboarding_invitation_accept()}
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

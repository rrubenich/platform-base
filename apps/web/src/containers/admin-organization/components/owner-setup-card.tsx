import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OwnerSetup } from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { useAdminOrganizationContext } from "../admin-organization.context";

/** The owner hasn't set up their login yet: resend the link or cancel. */
export function OwnerSetupCard({ ownerSetup }: { ownerSetup: OwnerSetup }) {
	const { resendOwnerSetup, cancelOwnerSetup } = useAdminOrganizationContext();
	const [isCancelling, setCancelling] = useState(false);
	const expired = ownerSetup.status === "expired";
	const date = formatDate(ownerSetup.expiresAt);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_owner_setup_title()}</CardTitle>
				<CardDescription>
					{m.admin_owner_setup_description({ email: ownerSetup.email })}
				</CardDescription>
				<CardAction>
					<Badge variant={expired ? "destructive" : "secondary"}>
						{expired
							? m.admin_owner_setup_expired()
							: m.admin_owner_setup_pending()}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardFooter className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					{expired
						? m.admin_owner_setup_expired_on({ date })
						: m.admin_owner_setup_expires({ date })}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setCancelling(true)}
					>
						{m.admin_owner_setup_cancel()}
					</Button>
					<Button size="sm" onClick={resendOwnerSetup}>
						{m.admin_owner_setup_resend()}
					</Button>
				</div>
			</CardFooter>
			<ConfirmDialog
				open={isCancelling}
				onOpenChange={setCancelling}
				title={m.admin_owner_setup_cancel_title()}
				description={m.admin_owner_setup_cancel_confirm({
					email: ownerSetup.email,
				})}
				confirmLabel={m.admin_owner_setup_cancel()}
				onConfirm={cancelOwnerSetup}
			/>
		</Card>
	);
}

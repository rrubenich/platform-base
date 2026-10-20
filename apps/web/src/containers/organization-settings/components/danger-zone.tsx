import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Fragment, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OrganizationDetails } from "@/lib/organization";
import { useOrganizationSettingsContext } from "../organization-settings.context";
import { DeleteOrganizationDialog } from "./delete-organization-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

function Row({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	);
}

export function DangerZone({
	organization,
}: {
	organization: OrganizationDetails;
}) {
	const { can, viewerRole, isPending, leave } =
		useOrganizationSettingsContext();
	const [transferOpen, setTransferOpen] = useState(false);
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	// Better Auth only lets an owner touch the owner role, so this one is
	// decided by role name rather than by a permission.
	const canTransfer = viewerRole === "owner";
	const canDelete = can({ organization: ["delete"] });

	const rows = [
		...(canTransfer
			? [
					<Row
						key="transfer"
						title={m.org_settings_transfer_title()}
						description={m.org_settings_transfer_description()}
						action={
							<Button variant="outline" onClick={() => setTransferOpen(true)}>
								{m.org_settings_transfer_title()}
							</Button>
						}
					/>,
				]
			: []),
		<Row
			key="leave"
			title={m.org_settings_leave_title()}
			description={m.org_settings_leave_description()}
			action={
				<Button
					variant="outline"
					disabled={isPending}
					onClick={() => setLeaveOpen(true)}
				>
					{m.org_settings_leave_title()}
				</Button>
			}
		/>,
		...(canDelete
			? [
					<Row
						key="delete"
						title={m.org_settings_delete_title()}
						description={m.org_settings_delete_description()}
						action={
							<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
								{m.org_settings_delete_title()}
							</Button>
						}
					/>,
				]
			: []),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.org_settings_danger_title()}</CardTitle>
				<CardDescription>{m.org_settings_danger_description()}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{rows.map((row, index) => (
					<Fragment key={row.key}>
						{index > 0 && <Separator />}
						{row}
					</Fragment>
				))}
			</CardContent>
			<TransferOwnershipDialog
				open={transferOpen}
				onOpenChange={setTransferOpen}
			/>
			<ConfirmDialog
				open={leaveOpen}
				onOpenChange={setLeaveOpen}
				title={m.org_settings_leave_confirm_title({ name: organization.name })}
				description={m.org_settings_leave_confirm_description()}
				confirmLabel={m.org_settings_leave_confirm()}
				onConfirm={() =>
					void leave().then((error) => {
						if (error) toast.error(error);
					})
				}
			/>
			<DeleteOrganizationDialog
				organization={organization}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
			/>
		</Card>
	);
}

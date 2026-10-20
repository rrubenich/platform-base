import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { UserIdentity } from "@/components/admin/user-badges";
import { memberRoleLabel, RoleSelect } from "@/components/role-select";
import { MEMBER_ROLES, type MemberRole } from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { type OrganizationMember, useMembersContext } from "../members.context";

const ASSIGNABLE_BY_ADMIN: readonly MemberRole[] = ["admin", "member"];

export function MembersTable() {
	const {
		organization,
		userId,
		viewerRole,
		can,
		isPending,
		updateRole,
		remove,
	} = useMembersContext();
	const [removing, setRemoving] = useState<OrganizationMember | null>(null);

	const canUpdate = can({ member: ["update"] });
	const canDelete = can({ member: ["delete"] });
	// Only an owner can hand out or touch the Owner role.
	const roles = viewerRole === "owner" ? MEMBER_ROLES : ASSIGNABLE_BY_ADMIN;
	const isManageable = (member: OrganizationMember) =>
		member.userId !== userId &&
		(viewerRole === "owner" || member.role !== "owner");
	const showActions = canDelete;

	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader className="bg-muted">
					<TableRow>
						<TableHead>{m.members_column_member()}</TableHead>
						<TableHead>{m.members_column_role()}</TableHead>
						<TableHead className="hidden md:table-cell">
							{m.members_column_joined()}
						</TableHead>
						{showActions && (
							<TableHead className="w-12">
								<span className="sr-only">{m.members_column_actions()}</span>
							</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{organization?.members.map((member) => {
						const manageable = isManageable(member);
						return (
							<TableRow key={member.id}>
								<TableCell>
									<UserIdentity user={member.user} />
								</TableCell>
								<TableCell>
									{canUpdate && manageable ? (
										<RoleSelect
											size="sm"
											value={member.role}
											roles={roles}
											disabled={isPending}
											aria-label={m.members_role_for({
												name: member.user.name,
											})}
											onChange={(role) => updateRole(member.id, role)}
										/>
									) : (
										<Badge variant="secondary">
											{memberRoleLabel(member.role)}
										</Badge>
									)}
								</TableCell>
								<TableCell className="hidden text-muted-foreground md:table-cell">
									{formatDate(member.createdAt)}
								</TableCell>
								{showActions && (
									<TableCell className="text-right">
										{manageable && (
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={m.members_remove_for({
													name: member.user.name,
												})}
												disabled={isPending}
												onClick={() => setRemoving(member)}
											>
												<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
											</Button>
										)}
									</TableCell>
								)}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			<ConfirmDialog
				open={removing !== null}
				onOpenChange={(open) => {
					if (!open) setRemoving(null);
				}}
				title={m.members_remove_title({ name: removing?.user.name ?? "" })}
				description={m.members_remove_description({
					organization: organization?.name ?? "",
				})}
				confirmLabel={m.members_remove_confirm()}
				onConfirm={() => {
					if (removing) remove(removing.id);
				}}
			/>
		</div>
	);
}

import {
	Delete02Icon,
	UserAdd01Icon,
	UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
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
import { FormDialog } from "@/components/admin/form-dialog";
import { UserIdentity } from "@/components/admin/user-badges";
import { RoleSelect } from "@/components/role-select";
import type {
	MemberRole,
	OrganizationDetail,
	OrganizationMember,
} from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { useAdminOrganizationContext } from "../admin-organization.context";

function AddMemberDialog() {
	const { addMember } = useAdminOrganizationContext();
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<MemberRole>("member");

	return (
		<>
			<Button size="sm" onClick={() => setOpen(true)}>
				<HugeiconsIcon
					icon={UserAdd01Icon}
					strokeWidth={2}
					data-icon="inline-start"
				/>
				{m.admin_member_add()}
			</Button>
			<FormDialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) {
						setEmail("");
						setRole("member");
					}
				}}
				title={m.admin_member_add()}
				description={m.admin_member_add_description()}
				submitLabel={m.admin_member_add_submit()}
				onSubmit={() => addMember({ email, role })}
			>
				<Field>
					<FieldLabel htmlFor="member-email">
						{m.admin_member_email_label()}
					</FieldLabel>
					<Input
						id="member-email"
						type="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="member-role">
						{m.admin_member_role_label()}
					</FieldLabel>
					<RoleSelect id="member-role" value={role} onChange={setRole} />
				</Field>
			</FormDialog>
		</>
	);
}

export function MembersCard({
	organization,
}: {
	organization: OrganizationDetail;
}) {
	const { updateMemberRole, removeMember, impersonate, isPending } =
		useAdminOrganizationContext();
	const [removing, setRemoving] = useState<OrganizationMember | null>(null);

	const teamCount = (userId: string) =>
		organization.teams.filter((team) => team.userIds.includes(userId)).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_members_title()}</CardTitle>
				<CardDescription>{m.admin_members_description()}</CardDescription>
				<CardAction>
					<AddMemberDialog />
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="bg-muted">
							<TableRow>
								<TableHead>{m.admin_column_user()}</TableHead>
								<TableHead>{m.admin_column_role()}</TableHead>
								<TableHead className="hidden text-right md:table-cell">
									{m.admin_column_teams()}
								</TableHead>
								<TableHead className="hidden lg:table-cell">
									{m.admin_column_joined()}
								</TableHead>
								<TableHead className="w-20">
									<span className="sr-only">{m.admin_column_actions()}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{organization.members.map((member) => (
								<TableRow key={member.id}>
									<TableCell>
										<Link
											to="/admin/users/$userId"
											params={{ userId: member.user.id }}
											className="block hover:underline"
										>
											<UserIdentity user={member.user} />
										</Link>
									</TableCell>
									<TableCell>
										<RoleSelect
											size="sm"
											value={member.role}
											disabled={isPending}
											aria-label={m.admin_member_role_for({
												name: member.user.name,
											})}
											onChange={(role) => updateMemberRole(member.id, role)}
										/>
									</TableCell>
									<TableCell className="hidden text-right tabular-nums md:table-cell">
										{teamCount(member.user.id)}
									</TableCell>
									<TableCell className="hidden text-muted-foreground lg:table-cell">
										{formatDate(member.createdAt)}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={m.admin_member_impersonate_for({
												name: member.user.name,
											})}
											disabled={isPending}
											onClick={() => impersonate(member.user.id)}
										>
											<HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={m.admin_member_remove_for({
												name: member.user.name,
											})}
											disabled={isPending}
											onClick={() => setRemoving(member)}
										>
											<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
			<ConfirmDialog
				open={removing !== null}
				onOpenChange={(open) => {
					if (!open) setRemoving(null);
				}}
				title={m.admin_member_remove_title({ name: removing?.user.name ?? "" })}
				description={m.admin_member_remove_description({
					organization: organization.name,
				})}
				confirmLabel={m.admin_member_remove()}
				onConfirm={() => {
					if (removing) removeMember(removing.id);
				}}
			/>
		</Card>
	);
}

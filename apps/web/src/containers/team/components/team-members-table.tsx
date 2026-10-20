import { Delete02Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
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
import { UserIdentity } from "@/components/admin/user-badges";
import { memberRoleLabel } from "@/components/role-select";
import { useTeamContext } from "../team.context";

export function TeamMembersTable() {
	const { members, can, isPending, remove } = useTeamContext();
	const canManage = can({ team: ["update"] });

	if (members.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
					</EmptyMedia>
					<EmptyTitle>{m.teams_members_empty_title()}</EmptyTitle>
					<EmptyDescription>
						{m.teams_members_empty_description()}
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
						<TableHead>{m.teams_column_member()}</TableHead>
						<TableHead>{m.members_column_role()}</TableHead>
						{canManage && (
							<TableHead className="w-12">
								<span className="sr-only">{m.teams_column_actions()}</span>
							</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.id}>
							<TableCell>
								<UserIdentity user={member.user} />
							</TableCell>
							<TableCell>
								<Badge variant="secondary">
									{memberRoleLabel(member.role)}
								</Badge>
							</TableCell>
							{canManage && (
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={m.teams_member_remove_for({
											name: member.user.name,
										})}
										disabled={isPending}
										onClick={() => remove(member.userId)}
									>
										<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
									</Button>
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

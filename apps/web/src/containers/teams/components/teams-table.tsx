import {
	Delete02Icon,
	Edit02Icon,
	UserGroup02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
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
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OrganizationTeam } from "@/lib/organization";
import { useTeamsContext } from "../teams.context";
import { TeamFormDialog } from "./team-form-dialog";

export function TeamsTable() {
	const { teams, can, isPending, rename, remove } = useTeamsContext();
	const [renaming, setRenaming] = useState<OrganizationTeam | null>(null);
	const [deleting, setDeleting] = useState<OrganizationTeam | null>(null);

	const canUpdate = can({ team: ["update"] });
	const canDelete = can({ team: ["delete"] });
	const showActions = canUpdate || canDelete;

	if (teams.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
					</EmptyMedia>
					<EmptyTitle>{m.teams_empty_title()}</EmptyTitle>
					<EmptyDescription>{m.teams_empty_description()}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader className="bg-muted">
					<TableRow>
						<TableHead>{m.teams_column_name()}</TableHead>
						<TableHead>{m.teams_column_members()}</TableHead>
						{showActions && (
							<TableHead className="w-24">
								<span className="sr-only">{m.teams_column_actions()}</span>
							</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{teams.map((team) => (
						<TableRow key={team.id}>
							<TableCell className="font-medium">
								<Link to="/teams/$teamId" params={{ teamId: team.id }}>
									{team.name}
								</Link>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{team.memberCount ?? 0}
							</TableCell>
							{showActions && (
								<TableCell className="text-right">
									{canUpdate && (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={m.teams_rename_for({ name: team.name })}
											disabled={isPending}
											onClick={() => setRenaming(team)}
										>
											<HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
										</Button>
									)}
									{canDelete && (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={m.teams_delete_for({ name: team.name })}
											disabled={isPending}
											onClick={() => setDeleting(team)}
										>
											<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
										</Button>
									)}
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
			<TeamFormDialog
				key={renaming?.id}
				open={renaming !== null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
				}}
				title={m.teams_rename_title()}
				submitLabel={m.teams_rename_submit()}
				initialName={renaming?.name}
				onSubmit={(name) =>
					renaming ? rename(renaming.id, name) : Promise.resolve(null)
				}
			/>
			<ConfirmDialog
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title={m.teams_delete_title({ name: deleting?.name ?? "" })}
				description={m.teams_delete_description()}
				confirmLabel={m.teams_delete_confirm()}
				onConfirm={() => {
					if (deleting) remove(deleting.id);
				}}
			/>
		</div>
	);
}

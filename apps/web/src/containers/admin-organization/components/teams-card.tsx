import {
	Delete02Icon,
	MoreHorizontalIcon,
	PencilEdit02Icon,
	PlusSignIcon,
	UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormDialog } from "@/components/admin/form-dialog";
import type { OrganizationDetail, OrganizationTeam } from "@/lib/admin-api";
import { formatNumber } from "@/lib/format";
import { initials } from "@/lib/initials";
import { useAdminOrganizationContext } from "../admin-organization.context";

const MAX_AVATARS = 5;

/** Create (no `team`) or rename (with `team`) a team. */
function TeamNameDialog({
	team,
	open,
	onOpenChange,
}: {
	team?: OrganizationTeam;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { createTeam, renameTeam } = useAdminOrganizationContext();
	const [name, setName] = useState(team?.name ?? "");

	return (
		<FormDialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (next) setName(team?.name ?? "");
			}}
			title={team ? m.admin_team_rename_title() : m.admin_team_create()}
			submitLabel={team ? m.admin_save() : m.admin_team_create_submit()}
			onSubmit={async () => {
				const failure = team
					? await renameTeam(team.id, name.trim())
					: await createTeam(name.trim());
				if (!failure && !team) setName("");
				return failure;
			}}
		>
			<Field>
				<FieldLabel htmlFor={team ? `team-name-${team.id}` : "team-name"}>
					{m.admin_team_name_label()}
				</FieldLabel>
				<Input
					id={team ? `team-name-${team.id}` : "team-name"}
					required
					maxLength={100}
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</Field>
		</FormDialog>
	);
}

/** Toggle which organization members are in a team. */
function TeamMembersDialog({
	organization,
	team,
	open,
	onOpenChange,
}: {
	organization: OrganizationDetail;
	team: OrganizationTeam;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { setTeamMembership, isPending } = useAdminOrganizationContext();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{m.admin_team_members_title({ name: team.name })}
					</DialogTitle>
					<DialogDescription>
						{m.admin_team_members_description()}
					</DialogDescription>
				</DialogHeader>
				<FieldSet>
					<FieldLegend className="sr-only">
						{m.admin_team_members_title({ name: team.name })}
					</FieldLegend>
					<FieldGroup className="max-h-80 gap-3 overflow-y-auto">
						{organization.members.map(({ user }) => (
							<Field key={user.id} orientation="horizontal">
								<Checkbox
									id={`team-${team.id}-${user.id}`}
									checked={team.userIds.includes(user.id)}
									disabled={isPending}
									onCheckedChange={(checked) =>
										setTeamMembership(team.id, user.id, checked === true)
									}
								/>
								<FieldContent>
									<FieldLabel htmlFor={`team-${team.id}-${user.id}`}>
										{user.name}
									</FieldLabel>
									<FieldDescription>{user.email}</FieldDescription>
								</FieldContent>
							</Field>
						))}
					</FieldGroup>
				</FieldSet>
			</DialogContent>
		</Dialog>
	);
}

function TeamRow({
	organization,
	team,
}: {
	organization: OrganizationDetail;
	team: OrganizationTeam;
}) {
	const { deleteTeam } = useAdminOrganizationContext();
	const [dialog, setDialog] = useState<"rename" | "members" | "delete" | null>(
		null,
	);
	const close = (open: boolean) => {
		if (!open) setDialog(null);
	};
	const members = organization.members
		.filter(({ user }) => team.userIds.includes(user.id))
		.map(({ user }) => user);

	return (
		<li className="flex items-center gap-4 py-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="truncate font-medium">{team.name}</span>
				<span className="text-sm text-muted-foreground">
					{m.admin_team_member_count({ count: formatNumber(team.memberCount) })}
				</span>
			</div>
			<AvatarGroup className="hidden sm:flex">
				{members.slice(0, MAX_AVATARS).map((user) => (
					<Avatar key={user.id} size="sm">
						<AvatarImage src={user.image ?? undefined} alt={user.name} />
						<AvatarFallback>{initials(user.name)}</AvatarFallback>
					</Avatar>
				))}
				{members.length > MAX_AVATARS && (
					<AvatarGroupCount>+{members.length - MAX_AVATARS}</AvatarGroupCount>
				)}
			</AvatarGroup>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.admin_actions_for({ name: team.name })}
						/>
					}
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => setDialog("members")}>
							<HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} />
							{m.admin_team_manage_members()}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setDialog("rename")}>
							<HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
							{m.admin_team_rename()}
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							onClick={() => setDialog("delete")}
						>
							<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
							{m.admin_action_delete()}
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<TeamMembersDialog
				organization={organization}
				team={team}
				open={dialog === "members"}
				onOpenChange={close}
			/>
			<TeamNameDialog
				team={team}
				open={dialog === "rename"}
				onOpenChange={close}
			/>
			<ConfirmDialog
				open={dialog === "delete"}
				onOpenChange={close}
				title={m.admin_team_delete_title({ name: team.name })}
				description={m.admin_team_delete_description()}
				confirmLabel={m.admin_action_delete()}
				onConfirm={() => deleteTeam(team.id)}
			/>
		</li>
	);
}

export function TeamsCard({
	organization,
}: {
	organization: OrganizationDetail;
}) {
	const [isCreateOpen, setCreateOpen] = useState(false);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_teams_title()}</CardTitle>
				<CardDescription>{m.admin_teams_description()}</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<HugeiconsIcon
							icon={PlusSignIcon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.admin_team_create()}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{organization.teams.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} />
							</EmptyMedia>
							<EmptyTitle>{m.admin_teams_empty_title()}</EmptyTitle>
							<EmptyDescription>
								{m.admin_teams_empty_description()}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="divide-y">
						{organization.teams.map((team) => (
							<TeamRow key={team.id} organization={organization} team={team} />
						))}
					</ul>
				)}
			</CardContent>
			<TeamNameDialog open={isCreateOpen} onOpenChange={setCreateOpen} />
		</Card>
	);
}

import { ArrowLeft01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { buttonVariants } from "@workspace/ui/components/button";
import { Button } from "@workspace/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useState } from "react";
import { AddMemberDialog } from "./components/add-member-dialog";
import { TeamMembersTable } from "./components/team-members-table";
import { useTeamContext } from "./team.context";

export function TeamPage() {
	const { team, isLoading, can } = useTeamContext();
	const [addOpen, setAddOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-6 p-4 md:p-6">
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	if (!team) {
		return (
			<div className="flex flex-col gap-6 p-4 md:p-6">
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>{m.teams_not_found_title()}</EmptyTitle>
						<EmptyDescription>
							{m.teams_not_found_description()}
						</EmptyDescription>
					</EmptyHeader>
					<Link to="/teams" className={buttonVariants({ variant: "outline" })}>
						{m.teams_back()}
					</Link>
				</Empty>
			</div>
		);
	}

	const canManage = can({ team: ["update"] });

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<Link
						to="/teams"
						className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} size={16} />
						{m.teams_back()}
					</Link>
					<h1 className="text-xl font-semibold">{team.name}</h1>
					<p className="text-sm text-muted-foreground">
						{m.teams_detail_description()}
					</p>
				</div>
				{canManage && (
					<Button onClick={() => setAddOpen(true)}>
						<HugeiconsIcon
							icon={UserAdd01Icon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.teams_member_add_button()}
					</Button>
				)}
			</header>
			<TeamMembersTable />
			<AddMemberDialog open={addOpen && canManage} onOpenChange={setAddOpen} />
		</div>
	);
}

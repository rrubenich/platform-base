import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useState } from "react";
import { TeamFormDialog } from "./components/team-form-dialog";
import { TeamsTable } from "./components/teams-table";
import { useTeamsContext } from "./teams.context";

export function TeamsPage() {
	const { isLoading, can, create } = useTeamsContext();
	const search = useSearch({ from: "/_workspace/teams/" });
	const navigate = useNavigate({ from: "/teams" });
	const [buttonOpen, setButtonOpen] = useState(false);
	const canCreate = can({ team: ["create"] });
	// The URL flag is authoritative; the permission gates at render time
	// because `can` is false while the organization loads.
	const createOpen = (search.new === 1 || buttonOpen) && canCreate;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold">{m.teams_title()}</h1>
					<p className="text-sm text-muted-foreground">
						{m.teams_description()}
					</p>
				</div>
				{canCreate && (
					<Button onClick={() => setButtonOpen(true)}>
						<HugeiconsIcon
							icon={Add01Icon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.teams_new_button()}
					</Button>
				)}
			</header>
			{isLoading ? <Skeleton className="h-48 w-full" /> : <TeamsTable />}
			<TeamFormDialog
				key="create"
				open={createOpen}
				onOpenChange={(next) => {
					setButtonOpen(next);
					if (!next && search.new) {
						void navigate({
							search: (previous) => ({ ...previous, new: undefined }),
							replace: true,
						});
					}
				}}
				title={m.teams_create_title()}
				description={m.teams_create_description()}
				submitLabel={m.teams_create_submit()}
				onSubmit={create}
			/>
		</div>
	);
}

import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useState } from "react";
import { InvitationsTable } from "./components/invitations-table";
import { InviteDialog } from "./components/invite-dialog";
import { MembersTable } from "./components/members-table";
import { useMembersContext } from "./members.context";

export function MembersPage() {
	const { organization, isLoading, can, pendingInvitations } =
		useMembersContext();
	const search = useSearch({ from: "/_workspace/members" });
	const navigate = useNavigate({ from: "/members" });
	const [buttonOpen, setButtonOpen] = useState(false);
	const canInvite = can({ invitation: ["create"] });
	// The URL flag is authoritative; the permission gates at render time
	// because `can` is false while the organization loads.
	const inviteOpen = (search.invite === 1 || buttonOpen) && canInvite;

	const pendingCount = pendingInvitations.length;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold">{m.members_title()}</h1>
					<p className="text-sm text-muted-foreground">
						{m.members_description()}
					</p>
				</div>
				{canInvite && (
					<Button onClick={() => setButtonOpen(true)}>
						<HugeiconsIcon
							icon={UserAdd01Icon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.members_invite_button()}
					</Button>
				)}
			</header>
			{isLoading || !organization ? (
				<Skeleton className="h-48 w-full" />
			) : (
				<Tabs
					value={search.tab ?? "members"}
					onValueChange={(tab) =>
						void navigate({
							search: (previous) => ({
								...previous,
								tab: tab === "invitations" ? "invitations" : undefined,
							}),
							replace: true,
						})
					}
				>
					<TabsList>
						<TabsTrigger value="members">{m.members_tab_members()}</TabsTrigger>
						<TabsTrigger value="invitations">
							{m.members_tab_invitations()}
							{pendingCount > 0 && ` (${pendingCount})`}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="members">
						<MembersTable />
					</TabsContent>
					<TabsContent value="invitations">
						<InvitationsTable />
					</TabsContent>
				</Tabs>
			)}
			<InviteDialog
				open={inviteOpen}
				onOpenChange={(next) => {
					setButtonOpen(next);
					if (!next && search.invite) {
						void navigate({
							search: (previous) => ({ ...previous, invite: undefined }),
							replace: true,
						});
					}
				}}
			/>
		</div>
	);
}

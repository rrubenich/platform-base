import { m } from "@workspace/i18n/messages";
import { memberRoleLabel } from "@/components/role-select";
import { useDashboardContext } from "../dashboard.context";
import { AskAssistant } from "./ask-assistant";
import { Contacts } from "./contacts";
import { TeamRosters } from "./team-rosters";

/** A member's home: the assistant, their teams, and who to ask. */
export function MemberHome() {
	const { viewerName, viewerRole, organizationName } = useDashboardContext();

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold">
					{m.home_greeting({ name: viewerName })}
				</h1>
				{viewerRole && organizationName && (
					<p className="text-sm text-muted-foreground">
						{m.home_description({
							role: memberRoleLabel(viewerRole).toLowerCase(),
							organization: organizationName,
						})}
					</p>
				)}
			</header>
			<AskAssistant />
			<div className="grid gap-6 lg:grid-cols-2">
				<TeamRosters />
				<Contacts />
			</div>
		</div>
	);
}

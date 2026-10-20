import { m } from "@workspace/i18n/messages";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DangerZone } from "./components/danger-zone";
import { GeneralCard } from "./components/general-card";
import { useOrganizationSettingsContext } from "./organization-settings.context";

export function OrganizationSettingsPage() {
	const { organization, isLoading } = useOrganizationSettingsContext();

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold">{m.org_settings_title()}</h1>
				<p className="text-sm text-muted-foreground">
					{m.org_settings_description()}
				</p>
			</header>
			{isLoading || !organization ? (
				<Skeleton className="h-48 w-full" />
			) : (
				<>
					<GeneralCard organization={organization} />
					<DangerZone organization={organization} />
				</>
			)}
		</div>
	);
}

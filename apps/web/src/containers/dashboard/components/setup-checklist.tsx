import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import { type SetupStep, useDashboardContext } from "../dashboard.context";

const STEPS: Record<
	SetupStep,
	{ label: () => string; to: "/members" | "/teams"; search?: object }
> = {
	invite: {
		label: m.dashboard_setup_invite,
		to: "/members",
		search: { invite: 1 },
	},
	team: { label: m.dashboard_setup_team, to: "/teams", search: { new: 1 } },
	assign: { label: m.dashboard_setup_assign, to: "/teams" },
};

/** First-run steps for a new organization; gone once they're all done. */
export function SetupChecklist() {
	const { setupSteps, isLoading } = useDashboardContext();
	const done = setupSteps.filter((step) => step.done).length;

	if (isLoading || done === setupSteps.length) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.dashboard_setup_title()}</CardTitle>
				<CardDescription>
					{m.dashboard_setup_progress({ done, total: setupSteps.length })}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="flex flex-col gap-2">
					{setupSteps.map(({ step, done: isDone }) => {
						const { label, to, search } = STEPS[step];
						return (
							<li key={step} className="flex items-center gap-2 text-sm">
								<HugeiconsIcon
									icon={isDone ? CheckmarkCircle02Icon : CircleIcon}
									strokeWidth={2}
									className={cn(
										"size-4",
										isDone ? "text-primary" : "text-muted-foreground",
									)}
									aria-label={
										isDone ? m.dashboard_setup_step_done() : undefined
									}
								/>
								{isDone ? (
									<span className="text-muted-foreground line-through">
										{label()}
									</span>
								) : (
									<Link
										to={to}
										search={search}
										className="font-medium hover:underline"
									>
										{label()}
									</Link>
								)}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}

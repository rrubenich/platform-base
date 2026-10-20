import { m } from "@workspace/i18n/messages";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@workspace/ui/components/chart";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { formatDay } from "@/lib/format";
import {
	GROWTH_RANGES,
	type GrowthRange,
	useAdminDashboardContext,
} from "../admin-dashboard.context";

const rangeLabel = (range: GrowthRange) =>
	({
		90: m.admin_growth_range_90(),
		30: m.admin_growth_range_30(),
		7: m.admin_growth_range_7(),
	})[range];

const isRange = (value: unknown): value is GrowthRange =>
	GROWTH_RANGES.includes(Number(value) as GrowthRange);

// dashboard-01's interactive area chart: sign-ups and new organizations.
export function GrowthChart() {
	const { growth, isGrowthLoading, range, setRange } =
		useAdminDashboardContext();
	const isMobile = useIsMobile();

	useEffect(() => {
		if (isMobile) setRange(7);
	}, [isMobile, setRange]);

	const chartConfig = {
		users: { label: m.admin_growth_users(), color: "var(--chart-1)" },
		organizations: {
			label: m.admin_growth_organizations(),
			color: "var(--chart-3)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="@container/card">
			<CardHeader>
				<CardTitle>{m.admin_growth_title()}</CardTitle>
				<CardDescription>{rangeLabel(range)}</CardDescription>
				<CardAction>
					<ToggleGroup
						multiple={false}
						value={[String(range)]}
						onValueChange={([value]) => {
							if (isRange(value)) setRange(Number(value) as GrowthRange);
						}}
						variant="outline"
						className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
					>
						{GROWTH_RANGES.map((option) => (
							<ToggleGroupItem key={option} value={String(option)}>
								{rangeLabel(option)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					<Select
						value={String(range)}
						onValueChange={(value) => {
							if (isRange(value)) setRange(Number(value) as GrowthRange);
						}}
					>
						<SelectTrigger
							className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
							size="sm"
							aria-label={m.admin_growth_range_label()}
						>
							<SelectValue>
								{(value: string) =>
									isRange(value)
										? rangeLabel(Number(value) as GrowthRange)
										: null
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectGroup>
								{GROWTH_RANGES.map((option) => (
									<SelectItem
										key={option}
										value={String(option)}
										className="rounded-lg"
									>
										{rangeLabel(option)}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				{isGrowthLoading || !growth ? (
					<Skeleton className="h-[250px] w-full" />
				) : (
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[250px] w-full"
					>
						<AreaChart data={growth}>
							<defs>
								<linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="5%"
										stopColor="var(--color-users)"
										stopOpacity={0.8}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-users)"
										stopOpacity={0.1}
									/>
								</linearGradient>
								<linearGradient
									id="fillOrganizations"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-organizations)"
										stopOpacity={0.8}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-organizations)"
										stopOpacity={0.1}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={32}
								tickFormatter={formatDay}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) => formatDay(String(value))}
										indicator="dot"
									/>
								}
							/>
							<Area
								dataKey="organizations"
								type="monotone"
								fill="url(#fillOrganizations)"
								stroke="var(--color-organizations)"
							/>
							<Area
								dataKey="users"
								type="monotone"
								fill="url(#fillUsers)"
								stroke="var(--color-users)"
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

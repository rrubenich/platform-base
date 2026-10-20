import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import { type AdminStats, adminApi, type GrowthPoint } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";

export const GROWTH_RANGES = [90, 30, 7] as const;
export type GrowthRange = (typeof GROWTH_RANGES)[number];

export type RecentUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
	role?: string | null;
	banned?: boolean | null;
	emailVerified: boolean;
	createdAt: Date;
};

const RECENT_USERS = 8;

type AdminDashboardContextValue = {
	stats: AdminStats | undefined;
	isStatsLoading: boolean;
	growth: GrowthPoint[] | undefined;
	isGrowthLoading: boolean;
	range: GrowthRange;
	setRange: (range: GrowthRange) => void;
	recentUsers: RecentUser[] | undefined;
	isRecentUsersLoading: boolean;
	isError: boolean;
};

const AdminDashboardContext = createContext<
	AdminDashboardContextValue | undefined
>(undefined);

export function AdminDashboardProvider({ children }: { children: ReactNode }) {
	const [range, setRange] = useState<GrowthRange>(90);

	const stats = useQuery({
		queryKey: ["admin", "stats"],
		queryFn: adminApi.stats,
	});
	const growth = useQuery({
		queryKey: ["admin", "growth", range],
		queryFn: () => adminApi.growth(range),
		placeholderData: (previous) => previous,
	});
	const recentUsers = useQuery({
		queryKey: ["admin", "users", "recent"],
		queryFn: async () => {
			const { data, error } = await authClient.admin.listUsers({
				query: {
					sortBy: "createdAt",
					sortDirection: "desc",
					limit: RECENT_USERS,
				},
			});
			if (error) throw error;
			return data.users as RecentUser[];
		},
	});

	const value: AdminDashboardContextValue = {
		stats: stats.data,
		isStatsLoading: stats.isLoading,
		growth: growth.data,
		isGrowthLoading: growth.isLoading,
		range,
		setRange,
		recentUsers: recentUsers.data,
		isRecentUsersLoading: recentUsers.isLoading,
		isError: stats.isError || growth.isError || recentUsers.isError,
	};

	return (
		<AdminDashboardContext.Provider value={value}>
			{children}
		</AdminDashboardContext.Provider>
	);
}

export function useAdminDashboardContext() {
	const context = useContext(AdminDashboardContext);

	if (context === undefined) {
		throw new Error(
			"useAdminDashboardContext must be used within an AdminDashboardProvider",
		);
	}

	return context;
}

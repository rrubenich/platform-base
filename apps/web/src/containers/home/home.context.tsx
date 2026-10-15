import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { apiGet } from "@/lib/api";

type HomeContextValue = {
	greeting: string | undefined;
	isLoading: boolean;
	isError: boolean;
	refetch: () => void;
};

const HomeContext = createContext<HomeContextValue | undefined>(undefined);

export function HomeProvider({ children }: { children: ReactNode }) {
	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ["hello"],
		queryFn: () => apiGet(""),
	});

	const value: HomeContextValue = {
		greeting: data,
		isLoading,
		isError,
		refetch,
	};

	return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHomeContext() {
	const context = useContext(HomeContext);

	if (context === undefined) {
		throw new Error("useHomeContext must be used within a HomeProvider");
	}

	return context;
}

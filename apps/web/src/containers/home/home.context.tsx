import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";

export type HomeUser = {
	name: string;
	email: string;
	image?: string | null;
};

type HomeContextValue = {
	user: HomeUser | undefined;
	signOut: () => Promise<void>;
	isSigningOut: boolean;
};

const HomeContext = createContext<HomeContextValue | undefined>(undefined);

export function HomeProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [isSigningOut, setSigningOut] = useState(false);

	async function signOut() {
		setSigningOut(true);
		try {
			await authClient.signOut();
			await navigate({ to: "/sign-in" });
		} finally {
			setSigningOut(false);
		}
	}

	const value: HomeContextValue = {
		user: session?.user,
		signOut,
		isSigningOut,
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

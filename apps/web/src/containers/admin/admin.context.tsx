import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import { authClient } from "@/lib/auth-client";
import { useSignOut } from "@/lib/sign-out";

export type AdminUser = {
	name: string;
	email: string;
	image?: string | null;
};

type AdminContextValue = {
	user: AdminUser | undefined;
	signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

/** The admin area's shell: who is signed in, and signing out. */
export function AdminProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const signOutAndForget = useSignOut();
	const { data: session } = authClient.useSession();

	async function signOut() {
		await signOutAndForget();
		await navigate({ to: "/sign-in" });
	}

	return (
		<AdminContext.Provider value={{ user: session?.user, signOut }}>
			{children}
		</AdminContext.Provider>
	);
}

export function useAdminContext() {
	const context = useContext(AdminContext);

	if (context === undefined) {
		throw new Error("useAdminContext must be used within an AdminProvider");
	}

	return context;
}

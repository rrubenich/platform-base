import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import { authClient } from "@/lib/auth-client";
import { can, ORGANIZATION_QUERY_KEY, type OrgRole } from "@/lib/organization";

type FullOrganizationResult = Awaited<
	ReturnType<typeof authClient.organization.getFullOrganization>
>;
export type FullOrganization = NonNullable<FullOrganizationResult["data"]>;

export type WorkspaceUser = {
	name: string;
	email: string;
	image?: string | null;
};

type WorkspaceContextValue = {
	organization: FullOrganization | undefined;
	role: OrgRole | undefined;
	userId: string | undefined;
	user: WorkspaceUser | undefined;
	can: (permissions: Record<string, string[]>) => boolean;
	isLoading: boolean;
	isError: boolean;
	signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
	undefined,
);

/** The workspace shell: the user's organization, their role in it, sign-out. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const userId = session?.user.id;

	const {
		data: organization,
		isLoading,
		isError,
	} = useQuery({
		queryKey: [...ORGANIZATION_QUERY_KEY, "full"],
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.getFullOrganization();
			if (error) throw new Error(error.message);
			return data ?? undefined;
		},
	});

	const role = organization?.members.find((member) => member.userId === userId)
		?.role as OrgRole | undefined;

	async function signOut() {
		await authClient.signOut();
		await navigate({ to: "/sign-in" });
	}

	return (
		<WorkspaceContext.Provider
			value={{
				organization,
				role,
				userId,
				user: session?.user,
				can: (permissions) => can(role, permissions),
				isLoading,
				isError,
				signOut,
			}}
		>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace() {
	const context = useContext(WorkspaceContext);

	if (context === undefined) {
		throw new Error("useWorkspace must be used within a WorkspaceProvider");
	}

	return context;
}

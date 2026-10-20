import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { toast } from "sonner";
import type { ManagedUser } from "@/components/admin/user-actions-menu";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import {
	type AdminUserActions,
	useAdminUserActions,
} from "@/lib/use-admin-user-actions";

export type UserDetail = ManagedUser & {
	image?: string | null;
	emailVerified: boolean;
	twoFactorEnabled?: boolean | null;
	banReason?: string | null;
	banExpires?: Date | string | null;
	createdAt: Date;
};

export type UserSession = {
	id: string;
	token: string;
	createdAt: Date;
	expiresAt: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
	impersonatedBy?: string | null;
};

type AdminUserContextValue = {
	user: UserDetail | undefined;
	isLoading: boolean;
	isError: boolean;
	sessions: UserSession[] | undefined;
	isSessionsLoading: boolean;
	isSelf: boolean;
	actions: AdminUserActions;
	revokeSession: (sessionToken: string) => void;
};

const AdminUserContext = createContext<AdminUserContextValue | undefined>(
	undefined,
);

export function AdminUserProvider({ children }: { children: ReactNode }) {
	const { userId } = useParams({ from: "/admin/users/$userId" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const actions = useAdminUserActions({
		onRemoved: () => navigate({ to: "/admin/users" }),
	});

	const user = useQuery({
		queryKey: ["admin", "user", userId],
		queryFn: async () => {
			const { data, error } = await authClient.admin.getUser({
				query: { id: userId },
			});
			if (error) throw error;
			return data as UserDetail;
		},
	});

	const sessions = useQuery({
		queryKey: ["admin", "user", userId, "sessions"],
		queryFn: async () => {
			const { data, error } = await authClient.admin.listUserSessions({
				userId,
			});
			if (error) throw error;
			return (data.sessions as UserSession[])
				.filter(({ expiresAt }) => new Date(expiresAt) > new Date())
				.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
		},
	});

	const revoke = useMutation({
		mutationFn: async (sessionToken: string) => {
			const { error } = await authClient.admin.revokeUserSession({
				sessionToken,
			});
			if (error) throw error;
		},
		onSuccess: async () => {
			toast.success(m.admin_toast_session_revoked());
			await queryClient.invalidateQueries({ queryKey: ["admin"] });
		},
		onError: (error) =>
			toast.error(authErrorMessage(error, m.admin_action_error())),
	});

	const value: AdminUserContextValue = {
		user: user.data,
		isLoading: user.isLoading,
		isError: user.isError,
		sessions: sessions.data,
		isSessionsLoading: sessions.isLoading,
		isSelf: session?.user.id === userId,
		actions,
		revokeSession: (sessionToken) => revoke.mutate(sessionToken),
	};

	return (
		<AdminUserContext.Provider value={value}>
			{children}
		</AdminUserContext.Provider>
	);
}

export function useAdminUserContext() {
	const context = useContext(AdminUserContext);

	if (context === undefined) {
		throw new Error(
			"useAdminUserContext must be used within an AdminUserProvider",
		);
	}

	return context;
}

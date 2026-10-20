import { useMutation, useQueryClient } from "@tanstack/react-query";
import { m } from "@workspace/i18n/messages";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";

type AuthResult<T> = Promise<{
	data: T | null;
	error: { status?: number; message?: string } | null;
}>;

export type BanInput = {
	userId: string;
	reason?: string;
	/** Seconds until the ban lifts; permanent when omitted. */
	expiresIn?: number;
};

export type AdminUserActions = {
	setRole: (userId: string, role: "admin" | "user") => Promise<void>;
	ban: (input: BanInput) => Promise<void>;
	unban: (userId: string) => Promise<void>;
	revokeSessions: (userId: string) => Promise<void>;
	impersonate: (userId: string) => Promise<void>;
	remove: (userId: string) => Promise<void>;
	isPending: boolean;
};

/**
 * Admin-plugin mutations on a user, shared by the users list and the user
 * detail page. Each one toasts its outcome and refreshes every admin query.
 */
export function useAdminUserActions({
	onRemoved,
}: {
	onRemoved?: () => void;
} = {}): AdminUserActions {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			request,
		}: {
			request: () => AuthResult<unknown>;
			success: string;
			after?: () => void;
		}) => {
			const { error } = await request();
			if (error) throw error;
		},
		onSuccess: async (_data, { success, after }) => {
			toast.success(success);
			await queryClient.invalidateQueries({ queryKey: ["admin"] });
			after?.();
		},
		onError: (error) => {
			toast.error(authErrorMessage(error, m.admin_action_error()));
		},
	});

	const run = (
		request: () => AuthResult<unknown>,
		success: string,
		after?: () => void,
	) =>
		mutation.mutateAsync({ request, success, after }).catch(() => {
			// Already surfaced as a toast by onError.
		});

	return {
		setRole: (userId, role) =>
			run(
				() => authClient.admin.setRole({ userId, role }),
				role === "admin" ? m.admin_toast_promoted() : m.admin_toast_demoted(),
			),
		ban: ({ userId, reason, expiresIn }) =>
			run(
				() =>
					authClient.admin.banUser({
						userId,
						banReason: reason || undefined,
						banExpiresIn: expiresIn,
					}),
				m.admin_toast_banned(),
			),
		unban: (userId) =>
			run(
				() => authClient.admin.unbanUser({ userId }),
				m.admin_toast_unbanned(),
			),
		revokeSessions: (userId) =>
			run(
				() => authClient.admin.revokeUserSessions({ userId }),
				m.admin_toast_sessions_revoked(),
			),
		// The session cookie now belongs to the user: reload into the app so
		// every cached session (and the impersonation banner) picks that up.
		impersonate: (userId) =>
			run(
				() => authClient.admin.impersonateUser({ userId }),
				m.admin_toast_impersonating(),
				() => window.location.assign("/"),
			),
		remove: (userId) =>
			run(
				() => authClient.admin.removeUser({ userId }),
				m.admin_toast_removed(),
				onRemoved,
			),
		isPending: mutation.isPending,
	};
}

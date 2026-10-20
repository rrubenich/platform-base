import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type SignOutError = NonNullable<
	Awaited<ReturnType<typeof authClient.signOut>>["error"]
>;

/**
 * Signs out and, once signed out, drops every cached query so the next user
 * on this browser never sees the previous one's data. Use it for every
 * sign-out; callers navigate afterwards.
 */
export function useSignOut() {
	const queryClient = useQueryClient();

	return async (): Promise<{ error: SignOutError | null }> => {
		const { error } = await authClient.signOut();
		if (!error) queryClient.clear();
		return { error: error ?? null };
	};
}

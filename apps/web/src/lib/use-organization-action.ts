import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/auth-error";
import { ORGANIZATION_QUERY_KEY } from "@/lib/organization";

export type AuthResult = {
	error?: { message?: string; status?: number; code?: string } | null;
};

type Options = {
	/** Toasted once the request succeeds. */
	success?: string;
	/** Shown when the error carries no message of its own. */
	fallback: string;
	/** Messages that replace the server's, by Better Auth error code. */
	codeMessages?: Record<string, string>;
};

/**
 * Runs a Better Auth organization request, then refreshes the organization.
 * `submit` resolves to an error message (for a form to show inline) or null;
 * `fire` toasts the error instead, for one-click actions.
 */
export function useOrganizationAction() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			request,
		}: {
			request: () => Promise<AuthResult>;
			success?: string;
		}) => {
			const { error } = await request();
			if (error) {
				throw Object.assign(new Error(error.message), {
					status: error.status,
					code: error.code,
				});
			}
		},
		onSuccess: async (_data, { success }) => {
			if (success) toast.success(success);
			await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		},
	});

	const submit = (
		request: () => Promise<AuthResult>,
		{ success, fallback, codeMessages }: Options,
	) =>
		mutation.mutateAsync({ request, success }).then(
			() => null,
			(error: { status?: number; message?: string; code?: string }) =>
				(error.code && codeMessages?.[error.code]) ||
				authErrorMessage(error, fallback),
		);

	const fire = (request: () => Promise<AuthResult>, options: Options) =>
		void submit(request, options).then((error) => {
			if (error) toast.error(error);
		});

	return { submit, fire, isPending: mutation.isPending };
}

import { m } from "@workspace/i18n/messages";

/**
 * The message to show for a failed Better Auth call.
 *
 * The API already translates coded errors into the user's locale. Rate
 * limiting (429) is answered before that translation runs, so it is mapped
 * here; anything else without a message falls back to `fallback`.
 */
export function authErrorMessage(
	error: { status?: number; message?: string },
	fallback: string,
): string {
	if (error.status === 429) return m.error_too_many_requests();
	return error.message || fallback;
}

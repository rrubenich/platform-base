import { ApiError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-error";

/** The message to show for a failed admin call (Nest or Better Auth). */
export function adminErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError) return error.message || fallback;
	if (error && typeof error === "object") {
		return authErrorMessage(
			error as { status?: number; message?: string },
			fallback,
		);
	}
	return fallback;
}

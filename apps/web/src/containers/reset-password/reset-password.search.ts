export type ResetPasswordSearch = {
	/** From the emailed link, once Better Auth has checked it. */
	token?: string;
	/** `INVALID_TOKEN` when the link was expired, used or unknown. */
	error?: string;
};

export function parseResetPasswordSearch(
	search: Record<string, unknown>,
): ResetPasswordSearch {
	return {
		...(typeof search.token === "string" && { token: search.token }),
		...(typeof search.error === "string" && { error: search.error }),
	};
}

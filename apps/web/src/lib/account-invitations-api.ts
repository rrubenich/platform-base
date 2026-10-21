import { apiJson } from "@/lib/api";

// The public side of account invitations: the token from the emailed link
// is the credential, no session needed.

const path = (token: string) =>
	`/account-invitations/${encodeURIComponent(token)}`;

export const accountInvitationsApi = {
	preview: (token: string) =>
		apiJson<{ email: string; organizationName: string }>(path(token)),

	accept: (token: string, body: { name: string; password: string }) =>
		apiJson<{ email: string }>(`${path(token)}/accept`, {
			method: "POST",
			body,
		}),
};

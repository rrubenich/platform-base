import { getLocale } from "@workspace/i18n/runtime";
import {
	adminClient,
	inferAdditionalFields,
	magicLinkClient,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// Better Auth rejects a relative baseURL. In dev VITE_API_URL is unset, so
// API_URL is the proxy-relative "/api" — resolving it against the current
// origin makes it absolute while keeping requests same-origin (session
// cookies then work through Vite's proxy). An absolute VITE_API_URL, as set
// in deployed environments, passes through unchanged.
const authBaseURL = new URL(
	`${API_URL}/auth`,
	window.location.origin,
).toString();

export const authClient = createAuthClient({
	baseURL: authBaseURL,
	// The API translates errors and emails from Accept-Language when the user
	// has no stored locale yet, so send the app's locale rather than the
	// browser default. Changing locale reloads the page, so this stays fresh.
	fetchOptions: { headers: { "Accept-Language": getLocale() } },
	plugins: [
		organizationClient({ teams: { enabled: true } }),
		adminClient(),
		magicLinkClient(),
		// No onTwoFactorRedirect: the sign-in context reads `twoFactorRedirect`
		// from the response and routes to /two-factor itself.
		twoFactorClient(),
		inferAdditionalFields({
			user: { locale: { type: "string", required: false } },
		}),
	],
});

export const { signIn, signUp, signOut, useSession } = authClient;

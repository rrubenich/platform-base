import {
	adminClient,
	magicLinkClient,
	organizationClient,
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
	plugins: [organizationClient(), adminClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

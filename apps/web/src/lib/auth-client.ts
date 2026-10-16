import {
	adminClient,
	magicLinkClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export const authClient = createAuthClient({
	baseURL: `${API_URL}/auth`,
	plugins: [organizationClient(), adminClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

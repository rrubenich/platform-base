import { createFileRoute } from "@tanstack/react-router";
import {
	parseResetPasswordSearch,
	ResetPasswordContainer,
} from "@/containers/reset-password";

// Public: the link also sets a first password for someone signed in with a
// social account (from /settings/account), so a session doesn't send it away.
export const Route = createFileRoute("/(auth)/reset-password")({
	validateSearch: parseResetPasswordSearch,
	component: ResetPasswordContainer,
});

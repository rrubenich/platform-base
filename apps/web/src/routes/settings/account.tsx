import { createFileRoute } from "@tanstack/react-router";
import { AccountContainer } from "@/containers/account";

export const Route = createFileRoute("/settings/account")({
	component: AccountContainer,
});

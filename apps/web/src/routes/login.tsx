import { createFileRoute } from "@tanstack/react-router";
import { LoginContainer } from "@/containers/login";

export const Route = createFileRoute("/login")({
	component: LoginContainer,
});

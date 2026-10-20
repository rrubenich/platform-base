import { createFileRoute } from "@tanstack/react-router";
import { SignUpContainer } from "@/containers/sign-up";

export const Route = createFileRoute("/(auth)/sign-up")({
	component: SignUpContainer,
});

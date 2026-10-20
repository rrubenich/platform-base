import { createFileRoute } from "@tanstack/react-router";
import { SignInContainer } from "@/containers/sign-in";

export const Route = createFileRoute("/(auth)/sign-in")({
	component: SignInContainer,
});

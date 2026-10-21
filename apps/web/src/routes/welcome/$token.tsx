import { createFileRoute } from "@tanstack/react-router";
import { WelcomeContainer } from "@/containers/welcome";

// Public: the page itself handles a visitor who's already signed in.
export const Route = createFileRoute("/welcome/$token")({
	component: WelcomeContainer,
});

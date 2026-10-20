import { createFileRoute } from "@tanstack/react-router";
import { HomeContainer } from "@/containers/home";

export const Route = createFileRoute("/_workspace/")({
	component: HomeContainer,
});

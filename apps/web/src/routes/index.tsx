import { createFileRoute } from "@tanstack/react-router";
import { HomeContainer } from "@/containers/home";
import { requireUser } from "@/lib/auth-guards";

export const Route = createFileRoute("/")({
	beforeLoad: requireUser,
	component: HomeContainer,
});

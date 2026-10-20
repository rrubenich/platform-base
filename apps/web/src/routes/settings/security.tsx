import { createFileRoute } from "@tanstack/react-router";
import { SecurityContainer } from "@/containers/security";

export const Route = createFileRoute("/settings/security")({
	component: SecurityContainer,
});

import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	AssistantContainer,
	parseAssistantSearch,
} from "@/containers/assistant";

export const Route = createFileRoute("/_workspace/assistant")({
	staticData: { title: () => m.org_nav_assistant() },
	validateSearch: parseAssistantSearch,
	component: AssistantContainer,
});

import { AiBookIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Spinner } from "@workspace/ui/components/spinner";
import { useEffect, useRef } from "react";
import {
	type Turn,
	useAdminDocsAssistantContext,
} from "../admin-docs-assistant.context";
import { Markdown } from "./markdown";
import { ToolActivity } from "./tool-activity";

const SUGGESTIONS = [
	() => m.docs_assistant_suggestion_architecture(),
	() => m.docs_assistant_suggestion_auth(),
	() => m.docs_assistant_suggestion_agents(),
	() => m.docs_assistant_suggestion_organizations(),
];

function Answer({ turn }: { turn: Extract<Turn, { role: "assistant" }> }) {
	return (
		<article
			aria-label={m.docs_assistant_assistant()}
			className="flex flex-col gap-2"
		>
			<ToolActivity tools={turn.tools} />
			{turn.content && <Markdown>{turn.content}</Markdown>}
			{turn.status === "streaming" && !turn.content && (
				<p className="flex items-center gap-2 text-muted-foreground text-sm">
					<Spinner />
					{m.docs_assistant_thinking()}
				</p>
			)}
			{turn.status === "stopped" && (
				<p className="text-muted-foreground text-xs">
					{m.docs_assistant_stopped()}
				</p>
			)}
			{(turn.status === "error" || turn.status === "forbidden") && (
				<Alert variant="destructive">
					<AlertDescription>
						{turn.status === "forbidden"
							? m.docs_assistant_forbidden()
							: m.docs_assistant_error()}
					</AlertDescription>
				</Alert>
			)}
		</article>
	);
}

function EmptyState() {
	const { send } = useAdminDocsAssistantContext();
	return (
		<div className="m-auto flex max-w-xl flex-col items-center gap-4 py-8 text-center">
			<div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
				<HugeiconsIcon icon={AiBookIcon} strokeWidth={2} className="size-6" />
			</div>
			<p className="text-muted-foreground text-sm">
				{m.docs_assistant_description()}
			</p>
			<div className="flex w-full flex-col gap-2">
				<p className="text-muted-foreground text-xs">
					{m.docs_assistant_suggestions()}
				</p>
				{SUGGESTIONS.map((suggestion) => (
					<button
						key={suggestion()}
						type="button"
						onClick={() => send(suggestion())}
						className="rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
					>
						{suggestion()}
					</button>
				))}
			</div>
		</div>
	);
}

export function Conversation() {
	const { turns } = useAdminDocsAssistantContext();
	const endRef = useRef<HTMLDivElement>(null);
	const last = turns.at(-1);

	// Follow the answer as it streams in.
	useEffect(() => {
		if (last) endRef.current?.scrollIntoView?.({ block: "end" });
	}, [last]);

	if (turns.length === 0) return <EmptyState />;

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			{turns.map((turn) =>
				turn.role === "user" ? (
					<article
						key={turn.id}
						aria-label={m.docs_assistant_you()}
						className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-primary-foreground text-sm"
					>
						{turn.content}
					</article>
				) : (
					<Answer key={turn.id} turn={turn} />
				),
			)}
			<div ref={endRef} />
		</div>
	);
}

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Spinner } from "@workspace/ui/components/spinner";
import { type ReactNode, useEffect, useRef } from "react";
import type { AgentChat, AssistantTurn, ToolCall } from "@/lib/use-agent-chat";
import { Markdown } from "./markdown";

/** The words that differ from one agent's chat to another's. */
export type ConversationCopy = {
	/** Shown above the suggestions before the first message. */
	description: string;
	/** While the answer hasn't started. */
	thinking: string;
	error: string;
	forbidden: string;
};

type ConversationProps = {
	chat: AgentChat;
	copy: ConversationCopy;
	icon: IconSvgElement;
	suggestions: string[];
	/** What the agent did for an answer, shown above it. */
	renderTools: (tools: ToolCall[]) => ReactNode;
};

function Answer({
	turn,
	copy,
	renderTools,
}: {
	turn: AssistantTurn;
} & Pick<ConversationProps, "copy" | "renderTools">) {
	return (
		<article aria-label={m.chat_assistant()} className="flex flex-col gap-2">
			{renderTools(turn.tools)}
			{turn.content && <Markdown>{turn.content}</Markdown>}
			{turn.status === "streaming" && !turn.content && (
				<p className="flex items-center gap-2 text-muted-foreground text-sm">
					<Spinner />
					{copy.thinking}
				</p>
			)}
			{turn.status === "stopped" && (
				<p className="text-muted-foreground text-xs">{m.chat_stopped()}</p>
			)}
			{(turn.status === "error" || turn.status === "forbidden") && (
				<Alert variant="destructive">
					<AlertDescription>
						{turn.status === "forbidden" ? copy.forbidden : copy.error}
					</AlertDescription>
				</Alert>
			)}
		</article>
	);
}

function EmptyState({
	chat,
	copy,
	icon,
	suggestions,
}: Pick<ConversationProps, "chat" | "copy" | "icon" | "suggestions">) {
	return (
		<div className="m-auto flex max-w-xl flex-col items-center gap-4 py-8 text-center">
			<div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
				<HugeiconsIcon icon={icon} strokeWidth={2} className="size-6" />
			</div>
			<p className="text-muted-foreground text-sm">{copy.description}</p>
			<div className="flex w-full flex-col gap-2">
				<p className="text-muted-foreground text-xs">{m.chat_suggestions()}</p>
				{suggestions.map((suggestion) => (
					<button
						key={suggestion}
						type="button"
						onClick={() => chat.send(suggestion)}
						className="rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
					>
						{suggestion}
					</button>
				))}
			</div>
		</div>
	);
}

/** An agent conversation: suggestions until the first message, then turns. */
export function Conversation(props: ConversationProps) {
	const { chat, copy, renderTools } = props;
	const endRef = useRef<HTMLDivElement>(null);
	const last = chat.turns.at(-1);

	// Follow the answer as it streams in.
	useEffect(() => {
		if (last) endRef.current?.scrollIntoView?.({ block: "end" });
	}, [last]);

	if (chat.turns.length === 0) return <EmptyState {...props} />;

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			{chat.turns.map((turn) =>
				turn.role === "user" ? (
					<article
						key={turn.id}
						aria-label={m.chat_you()}
						className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-primary-foreground text-sm"
					>
						{turn.content}
					</article>
				) : (
					<Answer
						key={turn.id}
						turn={turn}
						copy={copy}
						renderTools={renderTools}
					/>
				),
			)}
			<div ref={endRef} />
		</div>
	);
}

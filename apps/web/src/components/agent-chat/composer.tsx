import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import type { AgentChat } from "@/lib/use-agent-chat";

/** The message box under an agent conversation; stops a streaming answer. */
export function Composer({
	chat,
	placeholder,
}: {
	chat: AgentChat;
	placeholder: string;
}) {
	const { send, stop, isStreaming } = chat;
	const [message, setMessage] = useState("");

	const submit = (event?: FormEvent) => {
		event?.preventDefault();
		if (!message.trim() || isStreaming) return;
		send(message);
		setMessage("");
	};

	// Enter sends; Shift+Enter starts a new line.
	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.nativeEvent.isComposing
		) {
			event.preventDefault();
			submit();
		}
	};

	return (
		<form
			onSubmit={submit}
			className="mx-auto flex w-full max-w-3xl items-end gap-2"
		>
			<Textarea
				value={message}
				onChange={(event) => setMessage(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				aria-label={placeholder}
				rows={1}
				className="max-h-48 min-h-11"
			/>
			{isStreaming ? (
				<Button
					type="button"
					size="icon-lg"
					variant="secondary"
					onClick={stop}
					aria-label={m.chat_stop()}
				>
					<HugeiconsIcon icon={StopIcon} strokeWidth={2} />
				</Button>
			) : (
				<Button
					type="submit"
					size="icon-lg"
					disabled={!message.trim()}
					aria-label={m.chat_send()}
				>
					<HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
				</Button>
			)}
		</form>
	);
}

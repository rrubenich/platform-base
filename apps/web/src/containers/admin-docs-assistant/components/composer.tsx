import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { useAdminDocsAssistantContext } from "../admin-docs-assistant.context";

export function Composer() {
	const { send, stop, isStreaming } = useAdminDocsAssistantContext();
	const [question, setQuestion] = useState("");

	const submit = (event?: FormEvent) => {
		event?.preventDefault();
		if (!question.trim() || isStreaming) return;
		send(question);
		setQuestion("");
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
				value={question}
				onChange={(event) => setQuestion(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={m.docs_assistant_placeholder()}
				aria-label={m.docs_assistant_placeholder()}
				rows={1}
				className="max-h-48 min-h-11"
			/>
			{isStreaming ? (
				<Button
					type="button"
					size="icon-lg"
					variant="secondary"
					onClick={stop}
					aria-label={m.docs_assistant_stop()}
				>
					<HugeiconsIcon icon={StopIcon} strokeWidth={2} />
				</Button>
			) : (
				<Button
					type="submit"
					size="icon-lg"
					disabled={!question.trim()}
					aria-label={m.docs_assistant_send()}
				>
					<HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
				</Button>
			)}
		</form>
	);
}

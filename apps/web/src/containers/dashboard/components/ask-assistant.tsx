import { AiChat02Icon, ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Textarea } from "@workspace/ui/components/textarea";
import { type FormEvent, useState } from "react";

/** A question box that opens the assistant with the question asked. */
export function AskAssistant() {
	const navigate = useNavigate();
	const [question, setQuestion] = useState("");

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!question.trim()) return;
		void navigate({ to: "/assistant", search: { q: question.trim() } });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<HugeiconsIcon
						icon={AiChat02Icon}
						strokeWidth={2}
						className="size-4"
					/>
					{m.home_ask_title()}
				</CardTitle>
				<CardDescription>{m.home_ask_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit} className="flex items-end gap-2">
					<Textarea
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
						placeholder={m.home_ask_placeholder()}
						aria-label={m.home_ask_placeholder()}
						rows={2}
						className="min-h-11"
					/>
					<Button
						type="submit"
						size="icon-lg"
						disabled={!question.trim()}
						aria-label={m.home_ask_submit()}
					>
						<HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

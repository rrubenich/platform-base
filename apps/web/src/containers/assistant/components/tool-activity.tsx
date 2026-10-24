import { Wrench01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import type { ToolCall } from "@/lib/use-agent-chat";

/** The tools the assistant used for an answer, as chips above it. */
export function ToolActivity({ tools }: { tools: ToolCall[] }) {
	if (tools.length === 0) return null;
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="tools">
			{tools.map((tool, index) => (
				// Calls can repeat; the list only grows, so the order is stable.
				// oxlint-disable-next-line react/no-array-index-key -- append-only list
				<li key={index}>
					<Badge variant="secondary" className="gap-1 font-normal">
						<HugeiconsIcon
							icon={Wrench01Icon}
							strokeWidth={2}
							className="size-3"
						/>
						{m.assistant_tool({ name: tool.name })}
					</Badge>
				</li>
			))}
		</ul>
	);
}

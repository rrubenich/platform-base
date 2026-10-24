import {
	BookOpen01Icon,
	Files01Icon,
	Search01Icon,
	Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import type { ToolCall } from "@/lib/use-agent-chat";

function describe({ name, args }: ToolCall) {
	const text = (key: string) => String(args[key] ?? "");
	switch (name) {
		case "list_docs":
			return { icon: Files01Icon, label: m.docs_assistant_tool_list_docs() };
		case "search_docs":
			return {
				icon: Search01Icon,
				label: m.docs_assistant_tool_search_docs({ query: text("query") }),
			};
		case "read_doc":
			return {
				icon: BookOpen01Icon,
				label: m.docs_assistant_tool_read_doc({ path: text("path") }),
			};
		default:
			return {
				icon: Wrench01Icon,
				label: m.docs_assistant_tool_other({ name }),
			};
	}
}

/** What the agent looked up to answer, as small chips above the answer. */
export function ToolActivity({ tools }: { tools: ToolCall[] }) {
	if (tools.length === 0) return null;
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="tools">
			{tools.map((tool, index) => {
				const { icon, label } = describe(tool);
				return (
					// Calls can repeat with the same arguments; order is stable.
					// oxlint-disable-next-line react/no-array-index-key -- append-only list
					<li key={index}>
						<Badge variant="secondary" className="gap-1 font-normal">
							<HugeiconsIcon icon={icon} strokeWidth={2} className="size-3" />
							{label}
						</Badge>
					</li>
				);
			})}
		</ul>
	);
}

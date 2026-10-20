import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { formatNumber } from "@/lib/format";

/** "Page 2 of 5 · 93 results" with previous/next, for server-paged tables. */
export function TablePagination({
	page,
	pageSize,
	total,
	onPageChange,
}: {
	/** 1-based. */
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
}) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="flex items-center justify-between gap-4 px-2">
			<p className="text-sm text-muted-foreground">
				{m.admin_results({ count: formatNumber(total) })}
			</p>
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">
					{m.admin_page_of({ page, pageCount })}
				</span>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={m.admin_page_previous()}
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
				</Button>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={m.admin_page_next()}
					disabled={page >= pageCount}
					onClick={() => onPageChange(page + 1)}
				>
					<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
				</Button>
			</div>
		</div>
	);
}

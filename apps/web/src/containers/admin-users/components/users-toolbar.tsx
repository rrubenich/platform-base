import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Input } from "@workspace/ui/components/input";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { type FormEvent, useEffect, useState } from "react";
import { useAdminUsersContext } from "../admin-users.context";
import { USER_FILTERS, type UserFilter } from "../admin-users.search";

const ALL = "all";
const OPTIONS = [ALL, ...USER_FILTERS] as const;

const filterLabel = (filter: UserFilter | typeof ALL) =>
	({
		all: m.admin_nav_users_all(),
		admins: m.admin_nav_users_admins(),
		banned: m.admin_nav_users_banned(),
	})[filter];

export function UsersToolbar() {
	const { search, setQuery, setFilter } = useAdminUsersContext();
	const [query, setQueryInput] = useState(search.q ?? "");

	// Follow the URL when it changes elsewhere (e.g. the sidebar links).
	useEffect(() => setQueryInput(search.q ?? ""), [search.q]);

	function submit(event: FormEvent) {
		event.preventDefault();
		setQuery(query);
	}

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<search className="relative sm:w-80">
				<form onSubmit={submit}>
					<HugeiconsIcon
						icon={Search01Icon}
						strokeWidth={2}
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						aria-label={m.admin_users_search_label()}
						placeholder={m.admin_users_search_placeholder()}
						value={query}
						onChange={(event) => setQueryInput(event.target.value)}
						className="pl-9"
					/>
				</form>
			</search>
			<ToggleGroup
				multiple={false}
				variant="outline"
				size="sm"
				aria-label={m.admin_users_filter_label()}
				value={[search.filter ?? ALL]}
				onValueChange={([value]) => {
					const filter = USER_FILTERS.find((option) => option === value);
					setFilter(filter);
				}}
			>
				{OPTIONS.map((option) => (
					<ToggleGroupItem key={option} value={option}>
						{filterLabel(option)}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

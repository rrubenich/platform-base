import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Input } from "@workspace/ui/components/input";
import { type FormEvent, useEffect, useState } from "react";
import { useAdminOrganizationsContext } from "./admin-organizations.context";
import { CreateOrganizationDialog } from "./components/create-organization-dialog";
import { OrganizationsTable } from "./components/organizations-table";

export function AdminOrganizationsPage() {
	const { search, setQuery, isError } = useAdminOrganizationsContext();
	const [query, setQueryInput] = useState(search.q ?? "");

	useEffect(() => setQueryInput(search.q ?? ""), [search.q]);

	function submit(event: FormEvent) {
		event.preventDefault();
		setQuery(query);
	}

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold">{m.admin_orgs_title()}</h1>
					<p className="text-sm text-muted-foreground">
						{m.admin_orgs_description()}
					</p>
				</div>
				<CreateOrganizationDialog />
			</div>
			<search className="relative sm:w-80">
				<form onSubmit={submit}>
					<HugeiconsIcon
						icon={Search01Icon}
						strokeWidth={2}
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						aria-label={m.admin_orgs_search_label()}
						placeholder={m.admin_orgs_search_placeholder()}
						value={query}
						onChange={(event) => setQueryInput(event.target.value)}
						className="pl-9"
					/>
				</form>
			</search>
			{isError ? (
				<Alert variant="destructive">
					<AlertDescription>{m.admin_load_error()}</AlertDescription>
				</Alert>
			) : (
				<OrganizationsTable />
			)}
		</div>
	);
}

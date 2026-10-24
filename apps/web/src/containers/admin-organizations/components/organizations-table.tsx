import {
	Building03Icon,
	Delete02Icon,
	MoreHorizontalIcon,
	ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { TablePagination } from "@/components/admin/table-pagination";
import type { OrganizationSummary } from "@/lib/admin-api";
import { formatDate, formatNumber } from "@/lib/format";
import { initials } from "@/lib/initials";
import {
	ORGANIZATIONS_PAGE_SIZE,
	useAdminOrganizationsContext,
} from "../admin-organizations.context";

function OrganizationActions({
	organization,
}: {
	organization: OrganizationSummary;
}) {
	const { deleteOrganization } = useAdminOrganizationsContext();
	const [isDeleteOpen, setDeleteOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={m.admin_actions_for({ name: organization.name })}
						/>
					}
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuGroup>
						<DropdownMenuItem
							render={
								<Link
									to="/admin/organizations/$organizationId"
									params={{ organizationId: organization.id }}
								/>
							}
						>
							<HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
							{m.admin_action_view()}
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							onClick={() => setDeleteOpen(true)}
						>
							<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
							{m.admin_action_delete()}
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<ConfirmDialog
				open={isDeleteOpen}
				onOpenChange={setDeleteOpen}
				title={m.admin_delete_org_title({ name: organization.name })}
				description={m.admin_delete_org_description()}
				confirmLabel={m.admin_action_delete()}
				onConfirm={() => deleteOrganization(organization)}
			/>
		</>
	);
}

export function OrganizationsTable() {
	const { organizations, total, page, isLoading, setPage } =
		useAdminOrganizationsContext();

	if (!isLoading && organizations?.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={Building03Icon} strokeWidth={2} />
					</EmptyMedia>
					<EmptyTitle>{m.admin_orgs_empty_title()}</EmptyTitle>
					<EmptyDescription>
						{m.admin_orgs_empty_description()}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted">
						<TableRow>
							<TableHead>{m.admin_column_organization()}</TableHead>
							<TableHead className="text-right">
								{m.admin_column_members()}
							</TableHead>
							<TableHead className="text-right">
								{m.admin_column_teams()}
							</TableHead>
							<TableHead className="hidden md:table-cell">
								{m.admin_column_created()}
							</TableHead>
							<TableHead className="w-12">
								<span className="sr-only">{m.admin_column_actions()}</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading
							? Array.from({ length: 6 }, (_, index) => (
									<TableRow key={index}>
										<TableCell colSpan={5}>
											<Skeleton className="h-8 w-full" />
										</TableCell>
									</TableRow>
								))
							: organizations?.map((organization) => (
									<TableRow key={organization.id}>
										<TableCell>
											<Link
												to="/admin/organizations/$organizationId"
												params={{ organizationId: organization.id }}
												className="flex min-w-0 items-center gap-3 hover:underline"
											>
												<Avatar className="size-8 rounded-lg">
													<AvatarImage
														src={organization.logo ?? undefined}
														alt={organization.name}
													/>
													<AvatarFallback className="rounded-lg">
														{initials(organization.name)}
													</AvatarFallback>
												</Avatar>
												<div className="grid min-w-0 leading-tight">
													<span className="truncate font-medium">
														{organization.name}
													</span>
													<span className="truncate text-xs text-muted-foreground">
														{organization.slug}
													</span>
												</div>
											</Link>
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatNumber(organization.memberCount)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatNumber(organization.teamCount)}
										</TableCell>
										<TableCell className="hidden text-muted-foreground md:table-cell">
											{formatDate(organization.createdAt)}
										</TableCell>
										<TableCell className="text-right">
											<OrganizationActions organization={organization} />
										</TableCell>
									</TableRow>
								))}
					</TableBody>
				</Table>
			</div>
			<TablePagination
				page={page}
				pageSize={ORGANIZATIONS_PAGE_SIZE}
				total={total}
				onPageChange={setPage}
			/>
		</div>
	);
}

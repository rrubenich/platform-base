import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OrganizationDetail } from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/initials";
import { useAdminOrganizationContext } from "../admin-organization.context";
import { FormDialog } from "./form-dialog";

export function OrganizationHeaderCard({
	organization,
}: {
	organization: OrganizationDetail;
}) {
	const { update, remove } = useAdminOrganizationContext();
	const [isEditOpen, setEditOpen] = useState(false);
	const [isDeleteOpen, setDeleteOpen] = useState(false);
	const [name, setName] = useState(organization.name);
	const [slug, setSlug] = useState(organization.slug);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-4">
					<Avatar className="size-12 rounded-lg">
						<AvatarImage
							src={organization.logo ?? undefined}
							alt={organization.name}
						/>
						<AvatarFallback className="rounded-lg">
							{initials(organization.name)}
						</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-col gap-1">
						<CardTitle className="truncate text-xl">
							{organization.name}
						</CardTitle>
						<CardDescription className="truncate">
							{m.admin_org_header_meta({
								slug: organization.slug,
								date: formatDate(organization.createdAt),
							})}
						</CardDescription>
					</div>
				</div>
				<CardAction className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setName(organization.name);
							setSlug(organization.slug);
							setEditOpen(true);
						}}
					>
						<HugeiconsIcon
							icon={PencilEdit02Icon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.admin_edit()}
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setDeleteOpen(true)}
					>
						<HugeiconsIcon
							icon={Delete02Icon}
							strokeWidth={2}
							data-icon="inline-start"
						/>
						{m.admin_action_delete()}
					</Button>
				</CardAction>
			</CardHeader>
			<FormDialog
				open={isEditOpen}
				onOpenChange={setEditOpen}
				title={m.admin_org_edit_title()}
				submitLabel={m.admin_save()}
				onSubmit={() => update({ name: name.trim(), slug })}
			>
				<Field>
					<FieldLabel htmlFor="edit-org-name">
						{m.admin_org_name_label()}
					</FieldLabel>
					<Input
						id="edit-org-name"
						required
						maxLength={100}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="edit-org-slug">
						{m.admin_org_slug_label()}
					</FieldLabel>
					<Input
						id="edit-org-slug"
						required
						maxLength={100}
						pattern="[a-z0-9]+(-[a-z0-9]+)*"
						value={slug}
						onChange={(event) => setSlug(event.target.value)}
					/>
					<FieldDescription>{m.admin_org_slug_hint()}</FieldDescription>
				</Field>
			</FormDialog>
			<ConfirmDialog
				open={isDeleteOpen}
				onOpenChange={setDeleteOpen}
				title={m.admin_delete_org_title({ name: organization.name })}
				description={m.admin_delete_org_description()}
				confirmLabel={m.admin_action_delete()}
				onConfirm={remove}
			/>
		</Card>
	);
}

import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import type { OrganizationDetails } from "@/lib/organization";
import { useOrganizationSettingsContext } from "../organization-settings.context";

export function GeneralCard({
	organization,
}: {
	organization: OrganizationDetails;
}) {
	const {
		can,
		save,
		setSlug: reportSlug,
		slugTaken,
	} = useOrganizationSettingsContext();
	const canUpdate = can({ organization: ["update"] });
	const [name, setName] = useState(organization.name);
	const [slug, setSlug] = useState(organization.slug ?? "");
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isDirty =
		name.trim() !== organization.name || slug !== (organization.slug ?? "");

	async function submit(event: FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		const failure = await save({ name: name.trim(), slug });
		setSubmitting(false);
		if (failure) setError(failure);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.org_settings_general_title()}</CardTitle>
				<CardDescription>
					{canUpdate
						? m.org_settings_general_description()
						: m.org_settings_read_only()}
				</CardDescription>
			</CardHeader>
			<form onSubmit={submit}>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="org-name">
								{m.org_settings_name_label()}
							</FieldLabel>
							<Input
								id="org-name"
								required
								maxLength={100}
								disabled={!canUpdate}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field data-invalid={slugTaken ? true : undefined}>
							<FieldLabel htmlFor="org-slug">
								{m.org_settings_slug_label()}
							</FieldLabel>
							<Input
								id="org-slug"
								required
								maxLength={100}
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								disabled={!canUpdate}
								value={slug}
								aria-invalid={slugTaken ? true : undefined}
								onChange={(event) => {
									setSlug(event.target.value);
									reportSlug(event.target.value);
								}}
							/>
							{slugTaken ? (
								<FieldError>{m.org_settings_slug_taken()}</FieldError>
							) : (
								<FieldDescription>
									{m.org_settings_slug_hint()}
								</FieldDescription>
							)}
						</Field>
						{error && (
							<Field data-invalid>
								<FieldError>{error}</FieldError>
							</Field>
						)}
					</FieldGroup>
				</CardContent>
				{canUpdate && (
					<CardFooter>
						<Button
							type="submit"
							disabled={isSubmitting || !isDirty || slugTaken === true}
						>
							{isSubmitting && <Spinner data-icon="inline-start" />}
							{m.org_settings_save()}
						</Button>
					</CardFooter>
				)}
			</form>
		</Card>
	);
}

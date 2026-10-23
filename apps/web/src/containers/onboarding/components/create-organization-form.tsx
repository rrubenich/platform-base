import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
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
import { slugify } from "@/lib/slugify";

export type CreateOrganizationFormProps = {
	/** Resolves to an error message, or null on success. */
	onSubmit: (values: { name: string; slug: string }) => Promise<string | null>;
	onSlugChange: (slug: string) => void;
	slugTaken: boolean | undefined;
};

export function CreateOrganizationForm({
	onSubmit,
	onSlugChange,
	slugTaken,
}: CreateOrganizationFormProps) {
	const [name, setName] = useState("");
	const [slug, setSlugState] = useState("");
	const [isSlugEdited, setSlugEdited] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function setSlug(next: string) {
		setSlugState(next);
		onSlugChange(next);
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);
		const failure = await onSubmit({ name: name.trim(), slug });
		setIsSubmitting(false);
		if (failure) setError(failure);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.onboarding_create_title()}</CardTitle>
				<CardDescription>{m.onboarding_create_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="onboarding-name">
								{m.onboarding_name_label()}
							</FieldLabel>
							<Input
								id="onboarding-name"
								required
								maxLength={100}
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									if (!isSlugEdited) setSlug(slugify(event.target.value));
								}}
							/>
						</Field>
						<Field data-invalid={slugTaken ? true : undefined}>
							<FieldLabel htmlFor="onboarding-slug">
								{m.onboarding_slug_label()}
							</FieldLabel>
							<Input
								id="onboarding-slug"
								required
								maxLength={100}
								pattern="[a-z0-9]+(-[a-z0-9]+)*"
								value={slug}
								aria-invalid={slugTaken ? true : undefined}
								onChange={(event) => {
									setSlugEdited(true);
									setSlug(event.target.value);
								}}
							/>
							{slugTaken ? (
								<FieldError>{m.onboarding_slug_taken()}</FieldError>
							) : (
								<FieldDescription>{m.onboarding_slug_hint()}</FieldDescription>
							)}
						</Field>
						{error && (
							<Field data-invalid>
								<FieldError>{error}</FieldError>
							</Field>
						)}
						<Button type="submit" disabled={isSubmitting || slugTaken === true}>
							{isSubmitting && <Spinner data-icon="inline-start" />}
							{m.onboarding_create_submit()}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

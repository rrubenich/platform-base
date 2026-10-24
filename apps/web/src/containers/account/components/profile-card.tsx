import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
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
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, useState } from "react";
import { initials } from "@/lib/initials";
import { type AccountUser, useAccountContext } from "../account.context";

export function ProfileCard({ user }: { user: AccountUser }) {
	const { saveName } = useAccountContext();
	const [name, setName] = useState(user.name);
	const [isSubmitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isDirty = name.trim() !== "" && name.trim() !== user.name;

	async function submit(event: FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		setError(await saveName(name.trim()));
		setSubmitting(false);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.account_profile_title()}</CardTitle>
				<CardDescription>{m.account_profile_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit}>
					<FieldGroup>
						<div className="flex items-center gap-3">
							<Avatar className="size-12">
								{user.image && <AvatarImage src={user.image} alt={user.name} />}
								<AvatarFallback>{initials(user.name)}</AvatarFallback>
							</Avatar>
							<span className="text-sm text-muted-foreground">
								{user.email}
							</span>
						</div>
						<FieldError>{error}</FieldError>
						<Field>
							<FieldLabel htmlFor="account-name">
								{m.account_name_label()}
							</FieldLabel>
							<Input
								id="account-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoComplete="name"
								required
							/>
						</Field>
						<Field orientation="horizontal">
							<Button type="submit" disabled={!isDirty || isSubmitting}>
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{m.account_save()}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

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
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import type { FormEvent } from "react";
import type { PasswordAction } from "../security.context";

const DESCRIPTIONS: Record<PasswordAction, () => string> = {
	enable: m.security_password_enable,
	disable: m.security_password_disable,
	regenerate: m.security_password_regenerate,
};

export type PasswordConfirmFormProps = {
	action: PasswordAction;
	onConfirm: (values: { password: string }) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	error?: string | null;
};

export function PasswordConfirmForm({
	action,
	onConfirm,
	onCancel,
	isSubmitting = false,
	error,
}: PasswordConfirmFormProps) {
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		onConfirm({ password: String(data.get("password") ?? "") });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.two_factor_title()}</CardTitle>
				<CardDescription>{DESCRIPTIONS[action]()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<FieldError>{error}</FieldError>
						<Field>
							<FieldLabel htmlFor="password">
								{m.security_password_label()}
							</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								autoFocus
								required
							/>
						</Field>
						<Field orientation="horizontal">
							<Button type="submit" disabled={isSubmitting}>
								{m.security_continue()}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isSubmitting}
								onClick={onCancel}
							>
								{m.security_cancel()}
							</Button>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@workspace/ui/components/dialog";
import { FieldError, FieldGroup } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { type FormEvent, type ReactNode, useState } from "react";

/**
 * A dialog around a form whose submit resolves to an error message (shown
 * inline, dialog stays open) or null (dialog closes).
 */
export function FormDialog({
	open,
	onOpenChange,
	title,
	description,
	submitLabel,
	onSubmit,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	submitLabel: string;
	onSubmit: () => Promise<string | null>;
	children: ReactNode;
}) {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setSubmitting] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		const failure = await onSubmit();
		setSubmitting(false);
		setError(failure);
		if (!failure) onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setError(null);
			}}
		>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-6">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description && (
							<DialogDescription>{description}</DialogDescription>
						)}
					</DialogHeader>
					<FieldGroup>
						{children}
						{error && <FieldError>{error}</FieldError>}
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							{m.admin_cancel()}
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Spinner data-icon="inline-start" />}
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

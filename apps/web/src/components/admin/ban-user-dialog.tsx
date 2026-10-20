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
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { type FormEvent, useState } from "react";
import type { BanInput } from "@/lib/use-admin-user-actions";

const DAY = 24 * 60 * 60;

const DURATIONS = {
	permanent: undefined,
	"1d": DAY,
	"7d": 7 * DAY,
	"30d": 30 * DAY,
} as const;
type Duration = keyof typeof DURATIONS;

const durationLabel = (duration: Duration) =>
	({
		permanent: m.admin_ban_duration_permanent(),
		"1d": m.admin_ban_duration_days({ days: 1 }),
		"7d": m.admin_ban_duration_days({ days: 7 }),
		"30d": m.admin_ban_duration_days({ days: 30 }),
	})[duration];

export function BanUserDialog({
	user,
	open,
	onOpenChange,
	onBan,
}: {
	user: { id: string; name: string };
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onBan: (input: BanInput) => void;
}) {
	const [reason, setReason] = useState("");
	const [duration, setDuration] = useState<Duration>("permanent");

	function submit(event: FormEvent) {
		event.preventDefault();
		onBan({
			userId: user.id,
			reason: reason.trim(),
			expiresIn: DURATIONS[duration],
		});
		onOpenChange(false);
		setReason("");
		setDuration("permanent");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-6">
					<DialogHeader>
						<DialogTitle>{m.admin_ban_title({ name: user.name })}</DialogTitle>
						<DialogDescription>{m.admin_ban_description()}</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="ban-reason">
								{m.admin_ban_reason_label()}
							</FieldLabel>
							<Input
								id="ban-reason"
								value={reason}
								maxLength={200}
								onChange={(event) => setReason(event.target.value)}
							/>
							<FieldDescription>{m.admin_ban_reason_hint()}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="ban-duration">
								{m.admin_ban_duration_label()}
							</FieldLabel>
							<Select
								value={duration}
								onValueChange={(value) => {
									if (value && value in DURATIONS)
										setDuration(value as Duration);
								}}
							>
								<SelectTrigger id="ban-duration">
									<SelectValue>
										{(value: Duration) => durationLabel(value)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(Object.keys(DURATIONS) as Duration[]).map((option) => (
											<SelectItem key={option} value={option}>
												{durationLabel(option)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							{m.admin_cancel()}
						</Button>
						<Button type="submit" variant="destructive">
							{m.admin_ban_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import type { FormEvent } from "react";

export type TwoFactorMethod = "totp" | "otp" | "backup-code";

export type TwoFactorFormProps = Omit<
	React.ComponentProps<"div">,
	"children"
> & {
	method: TwoFactorMethod;
	onMethodChange: (method: TwoFactorMethod) => void;
	trustDevice: boolean;
	onTrustDeviceChange: (trustDevice: boolean) => void;
	onSendOtp: () => void;
	onVerify: (values: { code: string }) => void;
	isSubmitting?: boolean;
	error?: string | null;
	otpSent?: boolean;
};

const DESCRIPTIONS: Record<TwoFactorMethod, () => string> = {
	totp: m.two_factor_description_totp,
	otp: m.two_factor_description_otp,
	"backup-code": m.two_factor_description_backup_code,
};

// Links to the other methods, in the order they're offered.
const SWITCH_LABELS: Record<TwoFactorMethod, () => string> = {
	totp: m.two_factor_use_totp,
	otp: m.two_factor_use_otp,
	"backup-code": m.two_factor_use_backup_code,
};

export function TwoFactorForm({
	className,
	method,
	onMethodChange,
	trustDevice,
	onTrustDeviceChange,
	onSendOtp,
	onVerify,
	isSubmitting = false,
	error,
	otpSent = false,
	...props
}: TwoFactorFormProps) {
	// An emailed code has to be requested before there's anything to enter.
	const awaitingOtp = method === "otp" && !otpSent;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		onVerify({ code: String(data.get("code") ?? "").trim() });
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>{m.two_factor_title()}</CardTitle>
					<CardDescription>{DESCRIPTIONS[method]()}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							{method === "otp" && otpSent && (
								<FieldDescription role="status" className="text-center">
									{m.two_factor_otp_sent()}
								</FieldDescription>
							)}
							{awaitingOtp ? (
								<Button
									type="button"
									disabled={isSubmitting}
									onClick={onSendOtp}
								>
									{m.two_factor_send_otp()}
								</Button>
							) : (
								<>
									<Field>
										<FieldLabel htmlFor="code">
											{method === "backup-code"
												? m.two_factor_backup_code_label()
												: m.two_factor_code_label()}
										</FieldLabel>
										{/* Remounted per method so a half-typed code doesn't carry over. */}
										<Input
											key={method}
											id="code"
											name="code"
											required
											autoFocus
											autoComplete="one-time-code"
											{...(method !== "backup-code" && {
												inputMode: "numeric",
												pattern: "[0-9]{6}",
												maxLength: 6,
											})}
										/>
									</Field>
									<Field orientation="horizontal">
										<Checkbox
											id="trust-device"
											checked={trustDevice}
											onCheckedChange={(checked) =>
												onTrustDeviceChange(checked === true)
											}
										/>
										<FieldLabel htmlFor="trust-device" className="font-normal">
											{m.two_factor_trust_device()}
										</FieldLabel>
									</Field>
									<Field>
										<Button type="submit" disabled={isSubmitting}>
											{m.two_factor_submit()}
										</Button>
										{method === "otp" && (
											<Button
												type="button"
												variant="outline"
												disabled={isSubmitting}
												onClick={onSendOtp}
											>
												{m.two_factor_resend_otp()}
											</Button>
										)}
									</Field>
								</>
							)}
							<FieldDescription className="flex flex-col gap-1 text-center">
								{(Object.keys(SWITCH_LABELS) as TwoFactorMethod[])
									.filter((other) => other !== method)
									.map((other) => (
										<button
											key={other}
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onMethodChange(other)}
										>
											{SWITCH_LABELS[other]()}
										</button>
									))}
							</FieldDescription>
							<FieldDescription className="text-center">
								<Link to="/sign-in">{m.two_factor_back_to_sign_in()}</Link>
							</FieldDescription>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

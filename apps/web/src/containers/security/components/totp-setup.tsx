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
import type { FormEvent } from "react";
import QRCode from "react-qr-code";

export type TotpSetupProps = {
	/** The otpauth:// URI returned by twoFactor.enable. */
	totpURI: string;
	onVerify: (values: { code: string }) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	error?: string | null;
};

export function TotpSetup({
	totpURI,
	onVerify,
	onCancel,
	isSubmitting = false,
	error,
}: TotpSetupProps) {
	// The same secret the QR code encodes, for apps that can't scan.
	const secret = new URL(totpURI).searchParams.get("secret");

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		onVerify({ code: String(data.get("code") ?? "").trim() });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.two_factor_title()}</CardTitle>
				<CardDescription>{m.security_totp_scan()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						{/* White backing keeps the code scannable in dark mode. */}
						<div className="mx-auto rounded-lg bg-white p-3">
							<QRCode
								value={totpURI}
								size={176}
								title={m.security_totp_qr_label()}
							/>
						</div>
						{secret && (
							<FieldDescription className="text-center">
								{m.security_totp_manual()}{" "}
								<code className="font-mono break-all text-foreground">
									{secret}
								</code>
							</FieldDescription>
						)}
						<FieldError>{error}</FieldError>
						<Field>
							<FieldLabel htmlFor="code">
								{m.security_totp_code_label()}
							</FieldLabel>
							<Input
								id="code"
								name="code"
								inputMode="numeric"
								pattern="[0-9]{6}"
								maxLength={6}
								autoComplete="one-time-code"
								required
							/>
						</Field>
						<Field orientation="horizontal">
							<Button type="submit" disabled={isSubmitting}>
								{m.security_totp_verify()}
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

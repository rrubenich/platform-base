import { useNavigate } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import type { TwoFactorMethod } from "./components/two-factor-form";

type TwoFactorContextValue = {
	method: TwoFactorMethod;
	setMethod: (method: TwoFactorMethod) => void;
	trustDevice: boolean;
	setTrustDevice: (trustDevice: boolean) => void;
	isSubmitting: boolean;
	error: string | null;
	otpSent: boolean;
	sendOtp: () => void;
	verify: (values: { code: string }) => void;
};

const TwoFactorContext = createContext<TwoFactorContextValue | undefined>(
	undefined,
);

export function TwoFactorProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [method, setMethodState] = useState<TwoFactorMethod>("totp");
	const [trustDevice, setTrustDevice] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [otpSent, setOtpSent] = useState(false);

	function setMethod(nextMethod: TwoFactorMethod) {
		setError(null);
		setMethodState(nextMethod);
	}

	async function sendOtp() {
		setIsSubmitting(true);
		setError(null);

		const { error: sendError } = await authClient.twoFactor.sendOtp();

		setIsSubmitting(false);

		if (sendError) {
			setError(authErrorMessage(sendError, m.two_factor_error_send_otp()));
			return;
		}

		setOtpSent(true);
	}

	// Each method verifies against the two-factor cookie set at sign-in, and
	// creates the session on success.
	function verifyWith(body: { code: string; trustDevice: boolean }) {
		switch (method) {
			case "totp":
				return authClient.twoFactor.verifyTotp(body);
			case "otp":
				return authClient.twoFactor.verifyOtp(body);
			case "backup-code":
				return authClient.twoFactor.verifyBackupCode(body);
		}
	}

	async function verify(values: { code: string }) {
		setIsSubmitting(true);
		setError(null);

		const { error: verifyError } = await verifyWith({
			code: values.code,
			trustDevice,
		});

		setIsSubmitting(false);

		if (verifyError) {
			setError(authErrorMessage(verifyError, m.two_factor_error()));
			return;
		}

		navigate({ to: "/" });
	}

	const value: TwoFactorContextValue = {
		method,
		setMethod,
		trustDevice,
		setTrustDevice,
		isSubmitting,
		error,
		otpSent,
		sendOtp,
		verify,
	};

	return (
		<TwoFactorContext.Provider value={value}>
			{children}
		</TwoFactorContext.Provider>
	);
}

export function useTwoFactorContext() {
	const context = useContext(TwoFactorContext);

	if (context === undefined) {
		throw new Error(
			"useTwoFactorContext must be used within a TwoFactorProvider",
		);
	}

	return context;
}

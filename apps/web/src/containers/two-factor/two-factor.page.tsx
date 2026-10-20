import { LocaleSwitcher } from "@/components/locale-switcher";
import { TwoFactorForm } from "./components/two-factor-form";
import { useTwoFactorContext } from "./two-factor.context";

export function TwoFactorPage() {
	const {
		method,
		setMethod,
		trustDevice,
		setTrustDevice,
		isSubmitting,
		error,
		otpSent,
		sendOtp,
		verify,
	} = useTwoFactorContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<TwoFactorForm
					method={method}
					onMethodChange={setMethod}
					trustDevice={trustDevice}
					onTrustDeviceChange={setTrustDevice}
					onSendOtp={sendOtp}
					onVerify={verify}
					isSubmitting={isSubmitting}
					error={error}
					otpSent={otpSent}
				/>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

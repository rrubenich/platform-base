import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { BackupCodes } from "./components/backup-codes";
import { PasswordConfirmForm } from "./components/password-confirm-form";
import { TotpSetup } from "./components/totp-setup";
import { TwoFactorCard } from "./components/two-factor-card";
import { useSecurityContext } from "./security.context";

export function SecurityPage() {
	const {
		isLoading,
		twoFactorEnabled,
		hasPassword,
		view,
		isSubmitting,
		error,
		requestPassword,
		confirmPassword,
		verifyTotp,
		backToOverview,
	} = useSecurityContext();

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-4">
				<div className="flex items-center justify-between">
					<h1 className="text-lg font-medium">{m.security_title()}</h1>
					<Link to="/" className="text-sm underline-offset-4 hover:underline">
						{m.security_back_home()}
					</Link>
				</div>
				{isLoading ? null : view.step === "confirm-password" ? (
					<PasswordConfirmForm
						action={view.action}
						onConfirm={confirmPassword}
						onCancel={backToOverview}
						isSubmitting={isSubmitting}
						error={error}
					/>
				) : view.step === "verify-totp" ? (
					<TotpSetup
						totpURI={view.totpURI}
						onVerify={verifyTotp}
						onCancel={backToOverview}
						isSubmitting={isSubmitting}
						error={error}
					/>
				) : view.step === "backup-codes" ? (
					<BackupCodes codes={view.backupCodes} onDone={backToOverview} />
				) : (
					<TwoFactorCard
						enabled={twoFactorEnabled}
						hasPassword={hasPassword}
						onAction={requestPassword}
					/>
				)}
				<LocaleSwitcher />
			</div>
		</div>
	);
}

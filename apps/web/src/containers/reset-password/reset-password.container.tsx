import { ResetPasswordProvider } from "./reset-password.context";
import { ResetPasswordPage } from "./reset-password.page";

export function ResetPasswordContainer() {
	return (
		<ResetPasswordProvider>
			<ResetPasswordPage />
		</ResetPasswordProvider>
	);
}

import { ForgotPasswordProvider } from "./forgot-password.context";
import { ForgotPasswordPage } from "./forgot-password.page";

export function ForgotPasswordContainer() {
	return (
		<ForgotPasswordProvider>
			<ForgotPasswordPage />
		</ForgotPasswordProvider>
	);
}

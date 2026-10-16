import { LoginProvider } from "./login.context";
import { LoginPage } from "./login.page";

export function LoginContainer() {
	return (
		<LoginProvider>
			<LoginPage />
		</LoginProvider>
	);
}

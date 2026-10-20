import { SignInProvider } from "./sign-in.context";
import { SignInPage } from "./sign-in.page";

export function SignInContainer() {
	return (
		<SignInProvider>
			<SignInPage />
		</SignInProvider>
	);
}

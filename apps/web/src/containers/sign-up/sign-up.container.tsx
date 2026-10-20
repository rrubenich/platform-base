import { SignUpProvider } from "./sign-up.context";
import { SignUpPage } from "./sign-up.page";

export function SignUpContainer() {
	return (
		<SignUpProvider>
			<SignUpPage />
		</SignUpProvider>
	);
}

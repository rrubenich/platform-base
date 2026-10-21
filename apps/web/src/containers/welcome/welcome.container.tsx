import { WelcomeProvider } from "./welcome.context";
import { WelcomePage } from "./welcome.page";

export function WelcomeContainer() {
	return (
		<WelcomeProvider>
			<WelcomePage />
		</WelcomeProvider>
	);
}

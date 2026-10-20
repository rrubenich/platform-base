import { OnboardingProvider } from "./onboarding.context";
import { OnboardingPage } from "./onboarding.page";

export function OnboardingContainer() {
	return (
		<OnboardingProvider>
			<OnboardingPage />
		</OnboardingProvider>
	);
}

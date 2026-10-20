import { TwoFactorProvider } from "./two-factor.context";
import { TwoFactorPage } from "./two-factor.page";

export function TwoFactorContainer() {
	return (
		<TwoFactorProvider>
			<TwoFactorPage />
		</TwoFactorProvider>
	);
}

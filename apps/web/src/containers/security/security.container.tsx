import { SecurityProvider } from "./security.context";
import { SecurityPage } from "./security.page";

export function SecurityContainer() {
	return (
		<SecurityProvider>
			<SecurityPage />
		</SecurityProvider>
	);
}

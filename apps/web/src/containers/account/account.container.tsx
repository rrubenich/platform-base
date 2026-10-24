import { AccountProvider } from "./account.context";
import { AccountPage } from "./account.page";

export function AccountContainer() {
	return (
		<AccountProvider>
			<AccountPage />
		</AccountProvider>
	);
}

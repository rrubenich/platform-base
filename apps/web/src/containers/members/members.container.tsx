import { MembersProvider } from "./members.context";
import { MembersPage } from "./members.page";

export function MembersContainer() {
	return (
		<MembersProvider>
			<MembersPage />
		</MembersProvider>
	);
}

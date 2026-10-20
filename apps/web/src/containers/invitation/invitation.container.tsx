import { InvitationProvider } from "./invitation.context";
import { InvitationPage } from "./invitation.page";

export function InvitationContainer() {
	return (
		<InvitationProvider>
			<InvitationPage />
		</InvitationProvider>
	);
}

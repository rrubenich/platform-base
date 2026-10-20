import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Shown on every page while an admin is impersonating someone, so they
 * can't forget whose account they're acting in.
 */
export function ImpersonationBanner() {
	const { data: session } = authClient.useSession();
	const [isStopping, setStopping] = useState(false);

	if (!session?.session.impersonatedBy) return null;

	async function stop() {
		setStopping(true);
		const { error } = await authClient.admin.stopImpersonating();
		if (error) {
			setStopping(false);
			return;
		}
		// Back in the admin's own session: reload so everything picks it up.
		window.location.assign("/admin/users");
	}

	return (
		<div
			role="status"
			className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-primary px-4 py-2 text-sm text-primary-foreground"
		>
			<span>
				{m.impersonation_banner({
					name: session.user.name,
					email: session.user.email,
				})}
			</span>
			<Button
				size="xs"
				variant="secondary"
				onClick={stop}
				disabled={isStopping}
			>
				{isStopping && <Spinner data-icon="inline-start" />}
				{m.impersonation_stop()}
			</Button>
		</div>
	);
}

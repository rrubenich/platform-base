import { getLocale, isLocale, setLocale } from "@workspace/i18n/runtime";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Keeps the app's locale and the signed-in user's stored locale in step.
 *
 * A stored locale wins over this browser's (cookie / navigator) choice. A
 * user without one yet — e.g. right after a Google or magic-link sign-up —
 * gets the locale they signed up in.
 */
export function LocaleSync() {
	const { data: session } = authClient.useSession();
	const userId = session?.user.id;
	const userLocale = session?.user.locale;

	useEffect(() => {
		if (!userId) return;

		if (isLocale(userLocale)) {
			if (userLocale !== getLocale()) setLocale(userLocale);
			return;
		}

		void authClient.updateUser({ locale: getLocale() });
	}, [userId, userLocale]);

	return null;
}

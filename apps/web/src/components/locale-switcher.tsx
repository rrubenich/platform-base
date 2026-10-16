import { m } from "@workspace/i18n/messages";
import {
	getLocale,
	type Locale,
	locales,
	setLocale,
} from "@workspace/i18n/runtime";
import { cn } from "@workspace/ui/lib/utils";
import { authClient } from "@/lib/auth-client";

// Each language is named in itself, so it reads right whatever is active.
const LOCALE_NAMES: Record<Locale, string> = {
	"pt-BR": "Português",
	en: "English",
};

export function LocaleSwitcher({ className }: { className?: string }) {
	const { data: session } = authClient.useSession();
	const current = getLocale();

	async function changeLocale(locale: Locale) {
		if (locale === current) return;
		// The user record is the source of truth (emails, API errors), so
		// update it before switching; setLocale then reloads the page.
		if (session?.user) await authClient.updateUser({ locale });
		setLocale(locale);
	}

	return (
		<nav
			aria-label={m.locale_switcher_label()}
			className={cn("flex justify-center gap-3 text-sm", className)}
		>
			{locales.map((locale) => (
				<button
					key={locale}
					type="button"
					lang={locale}
					aria-pressed={locale === current}
					onClick={() => changeLocale(locale)}
					className="text-muted-foreground underline-offset-4 hover:underline aria-pressed:font-medium aria-pressed:text-foreground"
				>
					{LOCALE_NAMES[locale]}
				</button>
			))}
		</nav>
	);
}

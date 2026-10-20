import {
	AppleIcon,
	GoogleIcon,
	MicrosoftIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { FieldSeparator } from "@workspace/ui/components/field";

// Order matches the buttons' order on screen. Each id must be configured in
// `socialProviders` in apps/api/src/lib/auth.ts.
export const SOCIAL_PROVIDERS = ["google", "apple", "microsoft"] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

const PROVIDERS: Record<
	SocialProvider,
	{ name: string; icon: typeof GoogleIcon }
> = {
	google: { name: "Google", icon: GoogleIcon },
	apple: { name: "Apple", icon: AppleIcon },
	microsoft: { name: "Microsoft", icon: MicrosoftIcon },
};

/** The provider's brand name, untranslated. */
export function socialProviderName(provider: SocialProvider): string {
	return PROVIDERS[provider].name;
}

export type SocialSignOnProps = {
	/** Builds each button's label from the provider name, e.g. "Sign in with Google". */
	label: (values: { provider: string }) => string;
	onSelect: (provider: SocialProvider) => void;
	disabled?: boolean;
};

export function SocialSignOn({ label, onSelect, disabled }: SocialSignOnProps) {
	return (
		<>
			<FieldSeparator>{m.social_divider()}</FieldSeparator>
			<div className="flex flex-col gap-2">
				{SOCIAL_PROVIDERS.map((provider) => (
					<Button
						key={provider}
						variant="outline"
						type="button"
						disabled={disabled}
						onClick={() => onSelect(provider)}
					>
						<HugeiconsIcon icon={PROVIDERS[provider].icon} aria-hidden />
						{label({ provider: PROVIDERS[provider].name })}
					</Button>
				))}
			</div>
		</>
	);
}

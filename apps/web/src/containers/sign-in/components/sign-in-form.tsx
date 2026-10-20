import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import type { FormEvent } from "react";
import { type SocialProvider, SocialSignOn } from "@/components/social-sign-on";

export type SignInMode = "password" | "magic-link";

export type SignInFormProps = Omit<React.ComponentProps<"div">, "children"> & {
	mode: SignInMode;
	onModeChange: (mode: SignInMode) => void;
	onPasswordSignIn: (values: { email: string; password: string }) => void;
	onMagicLinkSignIn: (values: { email: string }) => void;
	onSocialSignIn: (provider: SocialProvider) => void;
	isSubmitting?: boolean;
	error?: string | null;
	magicLinkSent?: boolean;
	/** Prefills the email and makes it read-only. */
	lockedEmail?: string;
};

export function SignInForm({
	className,
	mode,
	onModeChange,
	onPasswordSignIn,
	onMagicLinkSignIn,
	onSocialSignIn,
	isSubmitting = false,
	error,
	magicLinkSent = false,
	lockedEmail,
	...props
}: SignInFormProps) {
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const email = String(data.get("email") ?? "");

		if (mode === "magic-link") {
			onMagicLinkSignIn({ email });
			return;
		}

		onPasswordSignIn({ email, password: String(data.get("password") ?? "") });
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>{m.sign_in_title()}</CardTitle>
					<CardDescription>{m.sign_in_description()}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							{magicLinkSent && (
								<FieldDescription role="status" className="text-center">
									{m.sign_in_magic_link_sent()}
								</FieldDescription>
							)}
							<Field>
								<FieldLabel htmlFor="email">
									{m.sign_in_email_label()}
								</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									placeholder="m@example.com"
									defaultValue={lockedEmail}
									readOnly={lockedEmail !== undefined}
									required
								/>
							</Field>
							{mode === "password" && (
								<Field>
									<div className="flex items-center">
										<FieldLabel htmlFor="password">
											{m.sign_in_password_label()}
										</FieldLabel>
										<a
											// biome-ignore lint/a11y/useValidAnchor: forgot-password page not built yet
											href="#"
											className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
										>
											{m.sign_in_forgot_password()}
										</a>
									</div>
									<Input
										id="password"
										name="password"
										type="password"
										required
									/>
								</Field>
							)}
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{mode === "magic-link"
										? m.sign_in_submit_magic_link()
										: m.sign_in_submit_password()}
								</Button>
								<FieldDescription className="text-center">
									{mode === "password" ? (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("magic-link")}
										>
											{m.sign_in_use_magic_link()}
										</button>
									) : (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("password")}
										>
											{m.sign_in_use_password()}
										</button>
									)}
								</FieldDescription>
							</Field>
							<SocialSignOn
								label={m.sign_in_social}
								onSelect={onSocialSignIn}
								disabled={isSubmitting}
							/>
							<FieldDescription className="text-center">
								{m.sign_in_no_account()}{" "}
								<Link to="/sign-up">{m.sign_in_sign_up()}</Link>
							</FieldDescription>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

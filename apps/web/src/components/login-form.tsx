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

export type LoginMode = "password" | "magic-link";

export type LoginFormProps = Omit<React.ComponentProps<"div">, "children"> & {
	mode: LoginMode;
	onModeChange: (mode: LoginMode) => void;
	onPasswordSignIn: (values: { email: string; password: string }) => void;
	onMagicLinkSignIn: (values: { email: string }) => void;
	onGoogleSignIn: () => void;
	isSubmitting?: boolean;
	error?: string | null;
	magicLinkSent?: boolean;
};

export function LoginForm({
	className,
	mode,
	onModeChange,
	onPasswordSignIn,
	onMagicLinkSignIn,
	onGoogleSignIn,
	isSubmitting = false,
	error,
	magicLinkSent = false,
	...props
}: LoginFormProps) {
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
					<CardTitle>{m.login_title()}</CardTitle>
					<CardDescription>{m.login_description()}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							{magicLinkSent && (
								<FieldDescription role="status" className="text-center">
									{m.login_magic_link_sent()}
								</FieldDescription>
							)}
							<Field>
								<FieldLabel htmlFor="email">{m.login_email_label()}</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									placeholder="m@example.com"
									required
								/>
							</Field>
							{mode === "password" && (
								<Field>
									<div className="flex items-center">
										<FieldLabel htmlFor="password">
											{m.login_password_label()}
										</FieldLabel>
										<a
											// biome-ignore lint/a11y/useValidAnchor: forgot-password page not built yet
											href="#"
											className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
										>
											{m.login_forgot_password()}
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
										? m.login_submit_magic_link()
										: m.login_submit_password()}
								</Button>
								<Button
									variant="outline"
									type="button"
									disabled={isSubmitting}
									onClick={onGoogleSignIn}
								>
									{m.login_google()}
								</Button>
								<FieldDescription className="text-center">
									{mode === "password" ? (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("magic-link")}
										>
											{m.login_use_magic_link()}
										</button>
									) : (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("password")}
										>
											{m.login_use_password()}
										</button>
									)}
								</FieldDescription>
								<FieldDescription className="text-center">
									{/* biome-ignore lint/a11y/useValidAnchor: sign-up page not built yet */}
									{m.login_no_account()} <a href="#">{m.login_sign_up()}</a>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

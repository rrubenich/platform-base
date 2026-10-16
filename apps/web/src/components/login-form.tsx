import type { FormEvent } from "react";

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
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your email below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<FieldError>{error}</FieldError>
							{magicLinkSent && (
								<FieldDescription role="status" className="text-center">
									Check your email for a sign-in link.
								</FieldDescription>
							)}
							<Field>
								<FieldLabel htmlFor="email">Email</FieldLabel>
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
										<FieldLabel htmlFor="password">Password</FieldLabel>
										<a
											// biome-ignore lint/a11y/useValidAnchor: forgot-password page not built yet
											href="#"
											className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
										>
											Forgot your password?
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
									{mode === "magic-link" ? "Send magic link" : "Login"}
								</Button>
								<Button
									variant="outline"
									type="button"
									disabled={isSubmitting}
									onClick={onGoogleSignIn}
								>
									Login with Google
								</Button>
								<FieldDescription className="text-center">
									{mode === "password" ? (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("magic-link")}
										>
											Email me a sign-in link
										</button>
									) : (
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("password")}
										>
											Use a password instead
										</button>
									)}
								</FieldDescription>
								<FieldDescription className="text-center">
									{/* biome-ignore lint/a11y/useValidAnchor: sign-up page not built yet */}
									Don&apos;t have an account? <a href="#">Sign up</a>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

import type { FormEvent } from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
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
			<Card className="overflow-hidden p-0">
				<CardContent className="grid p-0 md:grid-cols-2">
					<form className="p-6 md:p-8" onSubmit={handleSubmit}>
						<FieldGroup>
							<div className="flex flex-col items-center gap-2 text-center">
								<h1 className="text-2xl font-bold">Welcome back</h1>
								<p className="text-balance text-muted-foreground">
									Login to your Platform Base account
								</p>
							</div>
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
											className="ml-auto text-sm underline-offset-2 hover:underline"
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
							</Field>
							<FieldDescription className="text-center">
								{mode === "password" ? (
									<>
										Prefer not to use a password?{" "}
										<button
											type="button"
											className="underline underline-offset-4 hover:text-foreground"
											onClick={() => onModeChange("magic-link")}
										>
											Email me a sign-in link
										</button>
									</>
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
							<FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
								Or continue with
							</FieldSeparator>
							<Field>
								<Button
									variant="outline"
									type="button"
									disabled={isSubmitting}
									onClick={onGoogleSignIn}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
											fill="currentColor"
										/>
									</svg>
									Continue with Google
								</Button>
							</Field>
							<FieldDescription className="text-center">
								{/* biome-ignore lint/a11y/useValidAnchor: sign-up page not built yet */}
								Don&apos;t have an account? <a href="#">Sign up</a>
							</FieldDescription>
						</FieldGroup>
					</form>
					<div className="relative hidden bg-muted md:block">
						<img
							src="/login-panel.svg"
							alt=""
							className="absolute inset-0 h-full w-full object-cover"
						/>
					</div>
				</CardContent>
			</Card>
			<FieldDescription className="px-6 text-center">
				By clicking continue, you agree to our{" "}
				{/* biome-ignore lint/a11y/useValidAnchor: terms page not built yet */}
				<a href="#">Terms of Service</a>{" "}
				{/* biome-ignore lint/a11y/useValidAnchor: privacy page not built yet */}
				and <a href="#">Privacy Policy</a>.
			</FieldDescription>
		</div>
	);
}

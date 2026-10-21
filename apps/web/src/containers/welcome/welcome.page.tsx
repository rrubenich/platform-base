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
import { Skeleton } from "@workspace/ui/components/skeleton";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { WelcomeForm } from "./components/welcome-form";
import { useWelcomeContext } from "./welcome.context";

function WelcomeCard() {
	const { state, preview, signedInEmail, accept, signOut } =
		useWelcomeContext();

	if (state === "loading") return <Skeleton className="h-96 w-full" />;

	if (state === "ready" && preview && signedInEmail) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{m.welcome_title()}</CardTitle>
					<CardDescription>
						{m.welcome_signed_in_as({ email: signedInEmail })}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button className="w-full" onClick={() => void signOut()}>
						{m.welcome_sign_out()}
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (state === "ready" && preview) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{m.welcome_title()}</CardTitle>
					<CardDescription>
						{m.welcome_description({
							organization: preview.organizationName,
						})}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<WelcomeForm email={preview.email} onSubmit={accept} />
				</CardContent>
			</Card>
		);
	}

	const message = {
		expired: m.welcome_expired(),
		accepted: m.welcome_accepted(),
		invalid: m.welcome_invalid(),
	}[state as "expired" | "accepted" | "invalid"];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.welcome_title()}</CardTitle>
				<CardDescription role="status">
					{message ?? m.welcome_error()}
				</CardDescription>
			</CardHeader>
			{state === "accepted" && (
				<CardContent>
					<Button className="w-full" render={<Link to="/sign-in" />}>
						{m.welcome_sign_in()}
					</Button>
				</CardContent>
			)}
		</Card>
	);
}

export function WelcomePage() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<WelcomeCard />
				<LocaleSwitcher />
			</div>
		</div>
	);
}

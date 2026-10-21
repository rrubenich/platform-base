import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PendingInvitations } from "./components/pending-invitations";
import { useOnboardingContext } from "./onboarding.context";

export function OnboardingPage() {
	const {
		invitations,
		invitationsLoading,
		invitationsError,
		acceptingId,
		accept,
		signingOut,
		signOut,
	} = useOnboardingContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-4">
				<header className="flex flex-col gap-1 text-center">
					<h1 className="text-xl font-semibold">{m.onboarding_title()}</h1>
					<p className="text-sm text-muted-foreground">
						{m.onboarding_description()}
					</p>
				</header>
				{invitationsError && (
					<Alert variant="destructive">
						<AlertDescription>
							{m.onboarding_invitations_error()}
						</AlertDescription>
					</Alert>
				)}
				{invitations.length > 0 && (
					<PendingInvitations
						invitations={invitations}
						acceptingId={acceptingId}
						onAccept={accept}
					/>
				)}
				{!invitationsLoading &&
					!invitationsError &&
					invitations.length === 0 && (
						<Alert>
							<AlertDescription>
								{m.onboarding_no_organization()}
							</AlertDescription>
						</Alert>
					)}
				<div className="flex flex-wrap items-center justify-center gap-2">
					<Link
						to="/settings/security"
						className={buttonVariants({ variant: "ghost", size: "sm" })}
					>
						{m.onboarding_security_link()}
					</Link>
					<Button
						variant="ghost"
						size="sm"
						disabled={signingOut}
						onClick={() => void signOut()}
					>
						{m.onboarding_sign_out()}
					</Button>
				</div>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

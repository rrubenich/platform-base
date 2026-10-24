import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAccountContext } from "./account.context";
import { DeleteAccountCard } from "./components/delete-account-card";
import { EmailCard } from "./components/email-card";
import { PasswordCard } from "./components/password-card";
import { ProfileCard } from "./components/profile-card";
import { SessionsCard } from "./components/sessions-card";

// Outside the workspace layout, like /settings/security, so superadmins and
// users without an organization reach it too.
export function AccountPage() {
	const { isLoading, user } = useAccountContext();

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="flex w-full max-w-2xl flex-col gap-6">
				<header className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex flex-col gap-1">
						<h1 className="text-xl font-semibold">{m.account_title()}</h1>
						<p className="text-sm text-muted-foreground">
							{m.account_description()}
						</p>
					</div>
					<nav className="flex gap-4 text-sm">
						<Link
							to="/settings/security"
							className="underline-offset-4 hover:underline"
						>
							{m.account_security_link()}
						</Link>
						<Link to="/" className="underline-offset-4 hover:underline">
							{m.security_back_home()}
						</Link>
					</nav>
				</header>
				{isLoading || !user ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<>
						<ProfileCard user={user} />
						<EmailCard user={user} />
						<PasswordCard email={user.email} />
						<SessionsCard />
						<DeleteAccountCard user={user} />
					</>
				)}
				<LocaleSwitcher />
			</div>
		</div>
	);
}

import { Logout03Icon, SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Spinner } from "@workspace/ui/components/spinner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { initials } from "@/lib/initials";
import { useHomeContext } from "./home.context";

// Placeholder home for signed-in users until the product's real one exists.
export function HomePage() {
	const { user, signOut, isSigningOut } = useHomeContext();

	return (
		<main className="flex min-h-svh items-center justify-center p-6">
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<Avatar size="lg">
							<AvatarImage src={user?.image ?? undefined} alt={user?.name} />
							<AvatarFallback>{initials(user?.name ?? "")}</AvatarFallback>
						</Avatar>
					</EmptyMedia>
					<EmptyTitle>
						<h1>
							{user
								? m.home_welcome({ name: user.name })
								: m.home_welcome_anonymous()}
						</h1>
					</EmptyTitle>
					<EmptyDescription>{m.home_description()}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex flex-wrap justify-center gap-2">
						<Button variant="outline" render={<Link to="/settings/security" />}>
							<HugeiconsIcon
								icon={SecurityCheckIcon}
								strokeWidth={2}
								data-icon="inline-start"
							/>
							{m.home_security_link()}
						</Button>
						<Button variant="ghost" onClick={signOut} disabled={isSigningOut}>
							{isSigningOut ? (
								<Spinner data-icon="inline-start" />
							) : (
								<HugeiconsIcon
									icon={Logout03Icon}
									strokeWidth={2}
									data-icon="inline-start"
								/>
							)}
							{m.home_sign_out()}
						</Button>
					</div>
					<LocaleSwitcher />
				</EmptyContent>
			</Empty>
		</main>
	);
}

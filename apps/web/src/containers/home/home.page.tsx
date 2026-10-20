import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HelloStatus } from "./components/hello-status";
import { useHomeContext } from "./home.context";

export function HomePage() {
	const { greeting, isLoading, isError, refetch } = useHomeContext();

	return (
		<div className="flex min-h-svh p-6">
			<div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
				<div>
					<h1 className="font-medium">{m.home_title()}</h1>
					<p>{m.home_intro()}</p>
					<p>{m.home_button_note()}</p>
					<Button className="mt-2" onClick={() => refetch()}>
						{m.home_refetch()}
					</Button>
				</div>
				<HelloStatus
					greeting={greeting}
					isLoading={isLoading}
					isError={isError}
				/>
				<div className="text-muted-foreground font-mono text-xs">
					({m.home_dark_mode_press()} <kbd>d</kbd> {m.home_dark_mode_toggle()})
				</div>
				<Link to="/settings/security" className="underline underline-offset-4">
					{m.home_security_link()}
				</Link>
				<LocaleSwitcher className="justify-start" />
			</div>
		</div>
	);
}

import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Spinner } from "@workspace/ui/components/spinner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { memberRoleLabel } from "@/components/role-select";
import { initials } from "@/lib/initials";
import { useInvitationContext } from "./invitation.context";

function HomeEmpty({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card>
			<CardContent>
				<Empty>
					<EmptyHeader>
						<EmptyTitle>{title}</EmptyTitle>
						<EmptyDescription>{description}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							render={<Link to="/" />}
							nativeButton={false}
							variant="outline"
						>
							{m.invitation_go_home()}
						</Button>
					</EmptyContent>
				</Empty>
			</CardContent>
		</Card>
	);
}

function InvitationBody() {
	const {
		view,
		email,
		authSearch,
		pending,
		actionError,
		accept,
		reject,
		switchAccount,
		retry,
	} = useInvitationContext();

	switch (view.kind) {
		case "loading":
			return (
				<div className="flex justify-center p-6">
					<Spinner />
				</div>
			);
		case "signed-out":
			return (
				<Card>
					<CardHeader>
						<CardTitle>{m.invitation_title()}</CardTitle>
						<CardDescription>
							{email
								? m.invitation_signed_out_description({ email })
								: m.invitation_signed_out_generic()}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2">
						<Button
							className="w-full"
							render={<Link to="/sign-in" search={authSearch} />}
							nativeButton={false}
						>
							{m.invitation_sign_in()}
						</Button>
						<Button
							className="w-full"
							variant="outline"
							render={<Link to="/sign-up" search={authSearch} />}
							nativeButton={false}
						>
							{m.invitation_sign_up()}
						</Button>
					</CardFooter>
				</Card>
			);
		case "wrong-account":
			return (
				<Card>
					<CardHeader>
						<CardTitle>{m.invitation_wrong_account_title()}</CardTitle>
						<CardDescription>
							{m.invitation_wrong_account_description({
								current: view.currentEmail,
								email: email ?? "",
							})}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2">
						{actionError && (
							<Alert variant="destructive">
								<AlertDescription>{actionError}</AlertDescription>
							</Alert>
						)}
						<Button
							className="w-full"
							disabled={pending === "switch"}
							onClick={switchAccount}
						>
							{pending === "switch" && <Spinner data-icon="inline-start" />}
							{m.invitation_switch({ email: email ?? "" })}
						</Button>
					</CardFooter>
				</Card>
			);
		case "invalid":
			return (
				<HomeEmpty
					title={m.invitation_invalid_title()}
					description={m.invitation_invalid_description()}
				/>
			);
		case "unverified":
			return (
				<Card>
					<CardHeader>
						<CardTitle>{m.invitation_unverified_title()}</CardTitle>
						<CardDescription>
							{m.invitation_unverified_description()}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2">
						{actionError && (
							<Alert variant="destructive">
								<AlertDescription>{actionError}</AlertDescription>
							</Alert>
						)}
						<Button
							className="w-full"
							variant="outline"
							disabled={pending === "switch"}
							onClick={switchAccount}
						>
							{pending === "switch" && <Spinner data-icon="inline-start" />}
							{m.invitation_sign_out()}
						</Button>
					</CardFooter>
				</Card>
			);
		case "error":
			return (
				<Card>
					<CardContent className="flex flex-col gap-4">
						<Alert variant="destructive">
							<AlertDescription>{view.message}</AlertDescription>
						</Alert>
						<Button className="w-full" onClick={retry}>
							{m.invitation_retry()}
						</Button>
						<Button
							className="w-full"
							variant="outline"
							render={<Link to="/" />}
							nativeButton={false}
						>
							{m.invitation_go_home()}
						</Button>
					</CardContent>
				</Card>
			);
		case "declined":
			return (
				<HomeEmpty
					title={m.invitation_declined_title()}
					description={
						view.organizationName
							? m.invitation_declined_description({
									organization: view.organizationName,
								})
							: m.invitation_declined_generic()
					}
				/>
			);
		case "ready":
			return (
				<Card>
					<CardHeader className="items-center text-center">
						<Avatar size="lg">
							<AvatarFallback>
								{initials(view.invitation.organizationName)}
							</AvatarFallback>
						</Avatar>
						<CardTitle>{view.invitation.organizationName}</CardTitle>
						<CardDescription>
							{m.invitation_description({
								inviter: view.invitation.inviterEmail,
								organization: view.invitation.organizationName,
							})}
						</CardDescription>
						<CardDescription>
							{m.invitation_role({
								role: memberRoleLabel(view.invitation.role),
							})}
						</CardDescription>
					</CardHeader>
					<CardFooter className="flex flex-col gap-2">
						{actionError && (
							<Alert variant="destructive">
								<AlertDescription>{actionError}</AlertDescription>
							</Alert>
						)}
						<Button
							className="w-full"
							disabled={pending !== null}
							onClick={accept}
						>
							{pending === "accept" && <Spinner data-icon="inline-start" />}
							{m.invitation_accept()}
						</Button>
						<Button
							className="w-full"
							variant="outline"
							disabled={pending !== null}
							onClick={reject}
						>
							{pending === "reject" && <Spinner data-icon="inline-start" />}
							{m.invitation_reject()}
						</Button>
					</CardFooter>
				</Card>
			);
	}
}

export function InvitationPage() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<InvitationBody />
				<LocaleSwitcher />
			</div>
		</div>
	);
}

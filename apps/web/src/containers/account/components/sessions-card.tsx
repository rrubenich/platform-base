import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { type AccountSession, useAccountContext } from "../account.context";

function deviceName(session: AccountSession) {
	const device = describeUserAgent(session.userAgent);
	return device
		? m.account_sessions_device(device)
		: m.account_sessions_unknown_device();
}

export function SessionsCard() {
	const { sessions, isSessionsError, revokeSession, revokeOtherSessions } =
		useAccountContext();
	const [busy, setBusy] = useState<string | null>(null);

	async function act(key: string, action: () => Promise<string | null>) {
		setBusy(key);
		const failure = await action();
		setBusy(null);
		if (failure) toast.error(failure);
	}

	const others = sessions?.filter((session) => !session.isCurrent) ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.account_sessions_title()}</CardTitle>
				<CardDescription>{m.account_sessions_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{isSessionsError ? (
					<Alert variant="destructive">
						<AlertDescription>{m.account_sessions_error()}</AlertDescription>
					</Alert>
				) : sessions === undefined ? (
					<Skeleton className="h-16 w-full" />
				) : (
					<ul className="flex flex-col gap-3">
						{sessions.map((session) => (
							<li
								key={session.id}
								className="flex flex-wrap items-center justify-between gap-3"
							>
								<div className="flex min-w-0 flex-col">
									<span className="flex items-center gap-2 font-medium">
										{deviceName(session)}
										{session.isCurrent && (
											<Badge variant="secondary">
												{m.account_sessions_current()}
											</Badge>
										)}
									</span>
									<span className="text-sm text-muted-foreground">
										{[
											session.ipAddress,
											m.account_sessions_signed_in({
												date: formatDate(session.createdAt),
											}),
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</div>
								{!session.isCurrent && (
									<Button
										variant="outline"
										size="sm"
										disabled={busy !== null}
										onClick={() =>
											void act(session.token, () =>
												revokeSession(session.token),
											)
										}
									>
										{m.account_sessions_revoke()}
									</Button>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
			{others.length > 0 && (
				<CardFooter>
					<Button
						variant="outline"
						disabled={busy !== null}
						onClick={() => void act("others", revokeOtherSessions)}
					>
						{m.account_sessions_revoke_others()}
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}

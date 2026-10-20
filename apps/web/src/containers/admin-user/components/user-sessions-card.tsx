import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { formatDateTime } from "@/lib/format";
import { useAdminUserContext } from "../admin-user.context";

export function UserSessionsCard() {
	const { sessions, isSessionsLoading, revokeSession } = useAdminUserContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_sessions_title()}</CardTitle>
				<CardDescription>{m.admin_sessions_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{isSessionsLoading ? (
					<Skeleton className="h-24 w-full" />
				) : sessions?.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{m.admin_sessions_empty()}
					</p>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<Table>
							<TableHeader className="bg-muted">
								<TableRow>
									<TableHead>{m.admin_column_device()}</TableHead>
									<TableHead className="hidden md:table-cell">
										{m.admin_column_ip()}
									</TableHead>
									<TableHead className="hidden lg:table-cell">
										{m.admin_column_signed_in()}
									</TableHead>
									<TableHead className="hidden lg:table-cell">
										{m.admin_column_expires()}
									</TableHead>
									<TableHead className="w-24">
										<span className="sr-only">{m.admin_column_actions()}</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessions?.map((session) => (
									<TableRow key={session.id}>
										<TableCell className="max-w-64">
											<div className="flex flex-col gap-1">
												<span className="truncate">
													{session.userAgent ||
														m.admin_sessions_unknown_device()}
												</span>
												{session.impersonatedBy && (
													<Badge variant="outline" className="w-fit">
														{m.admin_sessions_impersonated()}
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell className="hidden md:table-cell">
											{session.ipAddress || "—"}
										</TableCell>
										<TableCell className="hidden text-muted-foreground lg:table-cell">
											{formatDateTime(session.createdAt)}
										</TableCell>
										<TableCell className="hidden text-muted-foreground lg:table-cell">
											{formatDateTime(session.expiresAt)}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="outline"
												size="sm"
												onClick={() => revokeSession(session.token)}
											>
												{m.admin_sessions_revoke()}
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { FieldDescription } from "@workspace/ui/components/field";
import type { PasswordAction } from "../security.context";

export type TwoFactorCardProps = {
	enabled: boolean;
	hasPassword: boolean;
	onAction: (action: PasswordAction) => void;
};

export function TwoFactorCard({
	enabled,
	hasPassword,
	onAction,
}: TwoFactorCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.two_factor_title()}</CardTitle>
				<CardDescription>{m.security_two_factor_description()}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{!hasPassword ? (
					<FieldDescription>
						{m.security_two_factor_no_password()}
					</FieldDescription>
				) : (
					<>
						<p role="status" className="text-sm font-medium">
							{enabled
								? m.security_two_factor_enabled()
								: m.security_two_factor_disabled()}
						</p>
						<div className="flex flex-wrap gap-2">
							{enabled ? (
								<>
									<Button
										variant="outline"
										onClick={() => onAction("regenerate")}
									>
										{m.security_regenerate_backup_codes()}
									</Button>
									<Button
										variant="destructive"
										onClick={() => onAction("disable")}
									>
										{m.security_disable()}
									</Button>
								</>
							) : (
								<Button onClick={() => onAction("enable")}>
									{m.security_enable()}
								</Button>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { useState } from "react";

export type BackupCodesProps = {
	codes: string[];
	onDone: () => void;
};

export function BackupCodes({ codes, onDone }: BackupCodesProps) {
	const [copied, setCopied] = useState(false);

	async function copyCodes() {
		await navigator.clipboard.writeText(codes.join("\n"));
		setCopied(true);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.security_backup_codes_title()}</CardTitle>
				<CardDescription>
					{m.security_backup_codes_description()}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
					{codes.map((code) => (
						<li key={code}>{code}</li>
					))}
				</ul>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={copyCodes}>
						{copied
							? m.security_backup_codes_copied()
							: m.security_backup_codes_copy()}
					</Button>
					<Button onClick={onDone}>{m.security_backup_codes_done()}</Button>
				</div>
			</CardContent>
		</Card>
	);
}

import { m } from "@workspace/i18n/messages";

type HelloStatusProps = {
	greeting: string | undefined;
	isLoading: boolean;
	isError: boolean;
};

export function HelloStatus({
	greeting,
	isLoading,
	isError,
}: HelloStatusProps) {
	const label = isLoading
		? m.hello_status_loading()
		: isError
			? m.hello_status_error()
			: greeting;

	return (
		<div className="text-muted-foreground font-mono text-xs">
			{m.hello_status_prefix()} {label}
		</div>
	);
}

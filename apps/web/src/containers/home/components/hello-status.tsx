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
		? "Connecting to API…"
		: isError
			? "Could not reach the API"
			: greeting;

	return (
		<div className="text-muted-foreground font-mono text-xs">
			API says: {label}
		</div>
	);
}

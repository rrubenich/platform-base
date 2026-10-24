// A readable name for the device behind a session's user agent, e.g.
// "Chrome on macOS". Good enough to tell sessions apart, not a full parser.

const BROWSERS: [RegExp, string][] = [
	[/Edg\//, "Edge"],
	[/OPR\/|Opera/, "Opera"],
	[/Firefox\//, "Firefox"],
	[/Chrome\/|CriOS\//, "Chrome"],
	[/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
	[/iPhone|iPad|iPod/, "iOS"],
	[/Android/, "Android"],
	[/Windows/, "Windows"],
	[/Mac OS X|Macintosh/, "macOS"],
	[/CrOS/, "ChromeOS"],
	[/Linux/, "Linux"],
];

const match = (userAgent: string, patterns: [RegExp, string][]) =>
	patterns.find(([pattern]) => pattern.test(userAgent))?.[1];

/** Browser and operating system, or undefined unless both are recognized. */
export function describeUserAgent(
	userAgent: string | null | undefined,
): { browser: string; os: string } | undefined {
	if (!userAgent) return undefined;
	const browser = match(userAgent, BROWSERS);
	const os = match(userAgent, SYSTEMS);
	return browser && os ? { browser, os } : undefined;
}

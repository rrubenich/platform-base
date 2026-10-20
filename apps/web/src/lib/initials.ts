/** Up to two initials for an avatar fallback, e.g. "Jane Doe" → "JD". */
export function initials(name: string): string {
	const letters = name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word[0]?.toUpperCase() ?? "");
	if (letters.length === 0) return "?";
	return letters.length === 1
		? letters[0]
		: `${letters[0]}${letters[letters.length - 1]}`;
}

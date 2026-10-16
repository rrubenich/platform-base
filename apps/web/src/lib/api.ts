import { getLocale } from "@workspace/i18n/runtime";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export async function apiGet(path: string): Promise<string> {
	const response = await fetch(`${API_URL}${path}`, {
		headers: { "Accept-Language": getLocale() },
	});
	if (!response.ok) {
		throw new Error(`API request failed: ${response.status}`);
	}
	return response.text();
}

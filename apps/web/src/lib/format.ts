import { getLocale } from "@workspace/i18n/runtime";

export const formatNumber = (value: number) =>
	new Intl.NumberFormat(getLocale()).format(value);

export const formatDate = (value: Date | string) =>
	new Date(value).toLocaleDateString(getLocale(), {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

export const formatDateTime = (value: Date | string) =>
	new Date(value).toLocaleString(getLocale(), {
		dateStyle: "medium",
		timeStyle: "short",
	});

/** A YYYY-MM-DD day (UTC), as a short "Oct 20" label. */
export const formatDay = (day: string) =>
	new Date(`${day}T00:00:00Z`).toLocaleDateString(getLocale(), {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});

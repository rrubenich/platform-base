import { Resend } from "resend";

// Constructed lazily so loading this config (e.g. the `better-auth` CLI) does
// not require RESEND_API_KEY to be set until an email actually needs sending.
let resend: Resend | undefined;
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY));
const emailFrom = process.env.EMAIL_FROM ?? "Platform Base <onboarding@resend.dev>";

// resend.emails.send() never throws on API errors (e.g. invalid recipient,
// unverified domain) — it resolves with { data: null, error }. Left
// unchecked, that error is silently discarded instead of reaching Better
// Auth's own error logging, so it's surfaced here as a thrown error instead.
export async function sendEmail(options: {
	to: string;
	subject: string;
	html: string;
}) {
	const { error } = await getResend().emails.send({
		from: emailFrom,
		...options,
	});
	if (error) {
		throw new Error(`Failed to send email via Resend: ${error.message}`);
	}
}

/** For interpolating user-provided text into an email's HTML. */
export const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

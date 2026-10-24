import * as Sentry from "@sentry/react";

export function initSentry() {
	const dsn = import.meta.env.VITE_SENTRY_DSN;

	if (!dsn) {
		return;
	}

	Sentry.init({
		dsn,
		environment: import.meta.env.MODE,
		integrations: [
			Sentry.browserTracingIntegration(),
			Sentry.replayIntegration(),
		],
		// Tracing
		tracesSampleRate: 1.0,
		tracePropagationTargets: [/\/api/],
		// Session Replay
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
		ignoreSpans: [/^POST faro-collector-prod-sa-east-1\.grafana\.net$/],
	});
}

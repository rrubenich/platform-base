import { datadogRum } from "@datadog/browser-rum";

export function initDatadogRum() {
	const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID;
	const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN;

	if (!applicationId || !clientToken) {
		return;
	}

	datadogRum.init({
		applicationId,
		clientToken,
		site: import.meta.env.VITE_DATADOG_SITE ?? "datadoghq.com",
		service: "web",
		env: import.meta.env.MODE,
		sessionSampleRate: 100,
		sessionReplaySampleRate: 0,
		trackUserInteractions: true,
		trackResources: true,
		trackLongTasks: true,
		defaultPrivacyLevel: "mask-user-input",
		// Lets RUM inject distributed-tracing headers into API calls so the
		// frontend trace connects to the backend trace (and its DB spans).
		allowedTracingUrls: [(url) => url.includes("/api")],
	});
}

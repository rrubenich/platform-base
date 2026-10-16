import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

export function initGrafanaFaro() {
	const url = import.meta.env.VITE_FARO_COLLECTOR_URL;

	if (!url) {
		return;
	}

	initializeFaro({
		url,
		app: {
			name: "platform-base",
			version: "1.0.0",
			environment: "production",
		},
		instrumentations: [
			// Mandatory, omits default instrumentations otherwise.
			...getWebInstrumentations(),

			// Tracing package to get end-to-end visibility for HTTP requests.
			new TracingInstrumentation(),
		],
	});
}

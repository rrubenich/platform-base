import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { config } from "dotenv";

// This module is loaded via `--import` before Nest's own ConfigModule runs,
// so OTEL_EXPORTER_OTLP_* must be loaded from .env here directly — otherwise
// the exporter falls back to its http://localhost:4318 default.
config();

const sdk = new NodeSDK({
	resource: defaultResource().merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "api",
			[ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? "0.0.1",
			"deployment.environment.name": process.env.NODE_ENV ?? "development",
		}),
	),
	// Reads OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS (Grafana
	// Cloud's OTLP gateway URL + Basic auth) from the environment.
	traceExporter: new OTLPTraceExporter(),
	instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

for (const signal of ["SIGTERM", "SIGINT"]) {
	process.on(signal, () => {
		sdk.shutdown().finally(() => process.exit(0));
	});
}

import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
	defaultResource,
	resourceFromAttributes,
} from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { config } from "dotenv";

// This module is loaded via `--import` before Nest's own ConfigModule runs,
// so OTEL_EXPORTER_OTLP_* must be loaded from .env here directly — otherwise
// the exporters fall back to their http://localhost:4318 default.
config();

const sdk = new NodeSDK({
	resource: defaultResource().merge(
		resourceFromAttributes({
			[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "api",
			[ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? "0.0.1",
			"deployment.environment.name": process.env.NODE_ENV ?? "development",
		}),
	),
	// Both read OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS
	// (Grafana Cloud's OTLP gateway URL + Basic auth) from the environment.
	traceExporter: new OTLPTraceExporter(),
	logRecordProcessors: [
		new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
	],
	instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Nest's ConsoleLogger and Better Auth's internal logger both write straight
// to console.*, with no OpenTelemetry integration of their own. Bridging
// console here is what actually gets those log lines (e.g. Better Auth's
// "Failed to run background task" errors) into Grafana — otherwise only
// traces are exported, and logs only ever reach Railway's own log capture.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function stringifyLogArg(arg: unknown): string {
	if (typeof arg === "string") return arg;
	if (arg instanceof Error) return arg.stack ?? arg.message;
	try {
		return JSON.stringify(arg);
	} catch {
		return String(arg);
	}
}

const CONSOLE_SEVERITY = {
	debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
	log: { number: SeverityNumber.INFO, text: "INFO" },
	info: { number: SeverityNumber.INFO, text: "INFO" },
	warn: { number: SeverityNumber.WARN, text: "WARN" },
	error: { number: SeverityNumber.ERROR, text: "ERROR" },
} as const;

const otelLogger = logs.getLogger(process.env.OTEL_SERVICE_NAME ?? "api");

for (const method of Object.keys(CONSOLE_SEVERITY) as Array<
	keyof typeof CONSOLE_SEVERITY
>) {
	const original = console[method].bind(console);
	const severity = CONSOLE_SEVERITY[method];
	console[method] = (...args: unknown[]) => {
		original(...args);
		otelLogger.emit({
			severityNumber: severity.number,
			severityText: severity.text,
			body: args.map(stringifyLogArg).join(" ").replace(ANSI_PATTERN, ""),
		});
	};
}

for (const signal of ["SIGTERM", "SIGINT"]) {
	process.on(signal, () => {
		sdk.shutdown().finally(() => process.exit(0));
	});
}

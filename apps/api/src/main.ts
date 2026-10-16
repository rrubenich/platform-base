import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import { json } from "express";
import { AppModule } from "./app.module.js";
import { auth } from "./lib/auth.js";

async function bootstrap() {
	// Better Auth needs the raw, unparsed request body, so Nest's default
	// body parser is disabled and re-enabled (via express.json()) only after
	// the auth handler is mounted.
	const app = await NestFactory.create(AppModule, { bodyParser: false });
	// The web app is served from a different origin, and Sentry/Faro tag
	// cross-origin requests with trace-propagation headers that force a CORS
	// preflight, so every route (not just Better Auth's own) needs CORS.
	app.enableCors({
		origin: process.env.WEB_URL ?? "http://localhost:5173",
		credentials: true,
	});
	app.use("/api/auth/*splat", toNodeHandler(auth));
	app.use(json());

	app.setGlobalPrefix("api");

	const swaggerConfig = new DocumentBuilder()
		.setTitle("Platform Base API")
		.setVersion("0.0.1")
		.build();
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup("docs", app, swaggerDocument);

	await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

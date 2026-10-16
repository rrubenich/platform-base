import { NestFactory } from "@nestjs/core";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import { json } from "express";
import { AppModule } from "./app.module.js";
import { auth } from "./lib/auth.js";

// `auth` is typed against the generic `BetterAuthOptions` (see lib/auth.ts)
// for declaration-emit portability, which erases the openAPI() plugin's
// `generateOpenAPISchema` method from its static type even though it exists
// at runtime. This narrows just the subset of its result this file reads.
type AuthOpenApiSchema = {
	paths: Record<string, OpenAPIObject["paths"][string]>;
	components: NonNullable<OpenAPIObject["components"]>;
	tags: { name: string; description: string }[];
};
const authApi = auth.api as unknown as {
	generateOpenAPISchema: () => Promise<AuthOpenApiSchema>;
};

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

	// Better Auth's routes are raw Express middleware, invisible to Nest's
	// decorator-based Swagger generation, so its own openAPI() plugin schema
	// is merged in here to document every auth method in the same /docs UI.
	const authSchema = await authApi.generateOpenAPISchema();
	for (const [path, pathItem] of Object.entries(authSchema.paths)) {
		swaggerDocument.paths[`/api/auth${path}`] =
			pathItem as OpenAPIObject["paths"][string];
	}
	swaggerDocument.components = {
		...swaggerDocument.components,
		schemas: {
			...swaggerDocument.components?.schemas,
			...authSchema.components.schemas,
		},
		securitySchemes: {
			...swaggerDocument.components?.securitySchemes,
			...authSchema.components.securitySchemes,
		},
	};
	swaggerDocument.tags = [...(swaggerDocument.tags ?? []), ...authSchema.tags];

	SwaggerModule.setup("docs", app, swaggerDocument);

	await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

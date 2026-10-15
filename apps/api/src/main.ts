import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule, ObserveInstrument } from "./app.module.js";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		instrument: ObserveInstrument,
	});
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

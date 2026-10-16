import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

describe("AppController", () => {
	let appController: AppController;

	beforeEach(async () => {
		const app: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [AppService],
		}).compile();

		appController = app.get<AppController>(AppController);
	});

	describe("root", () => {
		it("answers in the Accept-Language locale", () => {
			expect(appController.getHello({ "accept-language": "en-US" })).toBe(
				"Hello World!",
			);
			expect(appController.getHello({ "accept-language": "pt-PT" })).toBe(
				"Olá, mundo!",
			);
		});

		it("falls back to pt-BR", () => {
			expect(appController.getHello({})).toBe("Olá, mundo!");
		});
	});
});

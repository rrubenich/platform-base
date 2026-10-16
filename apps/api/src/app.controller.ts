import { Controller, Get, Headers } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service.js";
import { requestLocale } from "./i18n/i18n.js";

@ApiTags("app")
@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	@ApiOperation({ summary: "Say hello" })
	getHello(@Headers() headers: Record<string, string | undefined>): string {
		return this.appService.getHello(requestLocale(headers));
	}
}

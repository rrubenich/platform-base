import { Injectable } from "@nestjs/common";
import { m } from "@workspace/i18n/messages";
import type { Locale } from "./i18n/i18n.js";

@Injectable()
export class AppService {
	getHello(locale: Locale): string {
		return m.api_hello({}, { locale });
	}
}

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

export const REDIS_CONNECTION = Symbol("REDIS_CONNECTION");

@Module({
	providers: [
		{
			provide: REDIS_CONNECTION,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) =>
				new Redis(
					configService.get<string>("REDIS_URL", "redis://localhost:6379"),
				),
		},
	],
	exports: [REDIS_CONNECTION],
})
export class RedisModule {}

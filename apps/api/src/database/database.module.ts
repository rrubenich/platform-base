import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

@Module({
	providers: [
		{
			provide: DATABASE_CONNECTION,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const pool = new Pool({
					connectionString: configService.getOrThrow<string>("DATABASE_URL"),
				});
				return drizzle(pool, { schema });
			},
		},
	],
	exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}

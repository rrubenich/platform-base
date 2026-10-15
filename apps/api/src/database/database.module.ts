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
					connectionString: configService.get<string>(
						"DATABASE_URL",
						"postgres://platform-base:platform-base@localhost:5432/platform-base",
					),
				});
				return drizzle(pool, { schema });
			},
		},
	],
	exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}

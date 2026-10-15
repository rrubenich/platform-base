import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ?? "postgres://platform-base:platform-base@localhost:5432/platform-base",
});

await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();

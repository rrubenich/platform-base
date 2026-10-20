import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../database/schema.js";

/**
 * An in-memory Postgres (PGlite) with the app's migrations applied, for
 * tests that need real SQL semantics. Call `close()` when done.
 */
export async function createTestDatabase() {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder: "./drizzle" });
	return { db, close: () => client.close() };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>["db"];

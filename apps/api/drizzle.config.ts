import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/database/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgres://platform-base:platform-base@localhost:5432/platform-base",
	},
});

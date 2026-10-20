import { Global, Module } from "@nestjs/common";
import { auth } from "../lib/auth.js";
import { AUTH_INSTANCE } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";

// Global so any feature can put `@UseGuards(AuthGuard)` on its controllers
// without importing this module. Exposes the same Better Auth instance that
// main.ts mounts at /api/auth.
@Global()
@Module({
	providers: [{ provide: AUTH_INSTANCE, useValue: auth }, AuthGuard],
	exports: [AUTH_INSTANCE, AuthGuard],
})
export class AuthModule {}

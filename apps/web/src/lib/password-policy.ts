// Mirrors `emailAndPassword.minPasswordLength` / `maxPasswordLength` in
// apps/api/src/lib/auth.ts — keep both in step. The server enforces these;
// checking them here just gives immediate feedback.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

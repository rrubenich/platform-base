import { resolve, sep } from "node:path";
import { proxyToApi } from "./proxy";

// Deployed web server: serves the built app and proxies /api/* to the API
// service (see proxy.ts for why). In dev, Vite's server.proxy does the same.
const apiUrl = process.env.API_INTERNAL_URL;
if (!apiUrl) {
	throw new Error(
		"API_INTERNAL_URL is not set (e.g. http://api.railway.internal:3000)",
	);
}

const distDir = resolve(import.meta.dir, "../dist");
const indexHtml = Bun.file(`${distDir}/index.html`);

async function serveStatic(pathname: string): Promise<Response> {
	const path = resolve(distDir, `.${decodeURIComponent(pathname)}`);
	const file = Bun.file(path);
	if (path.startsWith(distDir + sep) && (await file.exists())) {
		// Vite fingerprints everything under assets/, so it never changes.
		const cacheControl = pathname.startsWith("/assets/")
			? "public, max-age=31536000, immutable"
			: "no-cache";
		return new Response(file, { headers: { "cache-control": cacheControl } });
	}
	// Client-side routes (TanStack Router) all render from index.html.
	return new Response(indexHtml, { headers: { "cache-control": "no-cache" } });
}

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3000),
	// Agent chats stream over SSE with pauses between tokens; Bun's 10s
	// default would cut them off. 255 is the maximum.
	idleTimeout: 255,
	fetch(request) {
		const { pathname } = new URL(request.url);
		if (pathname === "/api" || pathname.startsWith("/api/")) {
			return proxyToApi(request, apiUrl);
		}
		return serveStatic(pathname);
	},
});

console.log(`web listening on ${server.url}, proxying /api to ${apiUrl}`);

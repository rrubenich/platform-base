/**
 * Forwards a browser request for /api/* to the API service, so the browser
 * only ever talks to the web app's own origin. That keeps Better Auth's
 * session cookie first-party: with the API on another site (two
 * *.up.railway.app domains are different sites, it's a public suffix), the
 * browser drops the SameSite=Lax cookie and every sign-in looks like a
 * success followed by no session.
 */
export async function proxyToApi(
	request: Request,
	apiUrl: string,
	fetchApi: typeof fetch = fetch,
): Promise<Response> {
	const url = new URL(request.url);
	const target = new URL(`${url.pathname}${url.search}`, apiUrl);

	const headers = new Headers(request.headers);
	// fetch derives Host from the target URL; the browser's Host names this app.
	headers.delete("host");
	headers.set("x-forwarded-host", url.host);
	if (!headers.has("x-forwarded-proto")) {
		headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
	}

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	try {
		const response = await fetchApi(target, {
			method: request.method,
			headers,
			body: hasBody ? request.body : undefined,
			// OAuth flows answer with redirects meant for the browser.
			redirect: "manual",
			signal: request.signal,
			// Streams the request body; required by fetch when it's a stream.
			duplex: "half",
			// Bun only: keep the API's compressed body and Content-Encoding together.
			decompress: false,
		} as RequestInit);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (error) {
		// The browser went away (e.g. closed an agent chat stream): nobody to answer.
		if (request.signal.aborted) throw error;
		console.error(`API proxy: ${request.method} ${target} failed`, error);
		return new Response("Bad Gateway", { status: 502 });
	}
}

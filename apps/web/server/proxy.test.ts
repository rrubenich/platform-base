import { describe, expect, it, vi } from "vite-plus/test";
import { proxyToApi } from "./proxy";

const API_URL = "http://api.railway.internal:3000";

function upstream(response: Response) {
	return vi.fn<typeof fetch>().mockResolvedValue(response);
}

describe("proxyToApi", () => {
	it("forwards the path, query, method and body to the API", async () => {
		const fetchApi = upstream(new Response("ok"));
		const request = new Request(
			"https://web.example.com/api/auth/sign-in/email?callbackURL=%2F",
			{
				method: "POST",
				headers: { "content-type": "application/json", cookie: "a=1" },
				body: JSON.stringify({ email: "a@b.c" }),
			},
		);

		await proxyToApi(request, API_URL, fetchApi);

		const [target, init] = fetchApi.mock.calls[0];
		expect(String(target)).toBe(
			`${API_URL}/api/auth/sign-in/email?callbackURL=%2F`,
		);
		expect(init?.method).toBe("POST");
		expect(init?.redirect).toBe("manual");
		const headers = new Headers(init?.headers);
		expect(headers.get("cookie")).toBe("a=1");
		expect(headers.get("host")).toBeNull();
		expect(headers.get("x-forwarded-host")).toBe("web.example.com");
		expect(await new Response(init?.body).text()).toBe('{"email":"a@b.c"}');
	});

	it("passes every Set-Cookie and redirects back to the browser untouched", async () => {
		const headers = new Headers({ location: "https://accounts.google.com/x" });
		headers.append("set-cookie", "better-auth.session_token=s; Path=/");
		headers.append("set-cookie", "better-auth.state=t; Path=/");
		const fetchApi = upstream(new Response(null, { status: 302, headers }));

		const response = await proxyToApi(
			new Request("https://web.example.com/api/auth/sign-in/social"),
			API_URL,
			fetchApi,
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://accounts.google.com/x",
		);
		expect(response.headers.getSetCookie()).toEqual([
			"better-auth.session_token=s; Path=/",
			"better-auth.state=t; Path=/",
		]);
	});

	it("sends no body for GET requests", async () => {
		const fetchApi = upstream(new Response("{}"));

		await proxyToApi(
			new Request("https://web.example.com/api/auth/get-session"),
			API_URL,
			fetchApi,
		);

		expect(fetchApi.mock.calls[0][1]?.body).toBeUndefined();
	});

	it("answers 502 when the API is unreachable", async () => {
		const fetchApi = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError("fetch failed"));

		const response = await proxyToApi(
			new Request("https://web.example.com/api/health"),
			API_URL,
			fetchApi,
		);

		expect(response.status).toBe(502);
	});
});

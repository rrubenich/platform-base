import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { useSignOut } from "./sign-out";

vi.mock("@/lib/auth-client", () => ({
	authClient: { signOut: vi.fn() },
}));

function setup() {
	const queryClient = new QueryClient();
	queryClient.setQueryData(["organization", "full"], { id: "org-1" });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	const { result } = renderHook(() => useSignOut(), { wrapper });
	return { queryClient, signOut: result.current };
}

describe("useSignOut", () => {
	beforeEach(() => {
		vi.mocked(authClient.signOut)
			.mockReset()
			.mockResolvedValue({ data: { success: true }, error: null } as never);
	});

	it("signs out and forgets the previous user's cached data", async () => {
		const { queryClient, signOut } = setup();

		await expect(signOut()).resolves.toEqual({ error: null });

		expect(authClient.signOut).toHaveBeenCalled();
		expect(queryClient.getQueryData(["organization", "full"])).toBeUndefined();
	});

	it("keeps the cache and returns the error when sign-out fails", async () => {
		vi.mocked(authClient.signOut).mockResolvedValue({
			data: null,
			error: { message: "nope", status: 500 },
		} as never);
		const { queryClient, signOut } = setup();

		await expect(signOut()).resolves.toEqual({
			error: { message: "nope", status: 500 },
		});
		expect(queryClient.getQueryData(["organization", "full"])).toEqual({
			id: "org-1",
		});
	});
});

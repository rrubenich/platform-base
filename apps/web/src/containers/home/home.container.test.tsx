import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api";
import { HomeContainer } from "./home.container";

vi.mock("@/lib/api", () => ({
	apiGet: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

function renderHome() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<HomeContainer />
		</QueryClientProvider>,
	);
}

describe("HomeContainer", () => {
	beforeEach(() => {
		vi.mocked(apiGet).mockReset();
	});

	it("fetches the greeting from the API and displays it", async () => {
		vi.mocked(apiGet).mockResolvedValue("Hello World!");

		renderHome();

		expect(
			screen.getByText("API says: Connecting to API…"),
		).toBeInTheDocument();
		expect(
			await screen.findByText("API says: Hello World!"),
		).toBeInTheDocument();
		expect(apiGet).toHaveBeenCalledWith("");
	});

	it("shows an error state and recovers when the user refetches", async () => {
		vi.mocked(apiGet).mockRejectedValueOnce(new Error("network down"));
		vi.mocked(apiGet).mockResolvedValueOnce("Hello World!");

		renderHome();

		expect(
			await screen.findByText("API says: Could not reach the API"),
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "Refetch hello world" }),
		);

		expect(
			await screen.findByText("API says: Hello World!"),
		).toBeInTheDocument();
		expect(apiGet).toHaveBeenCalledTimes(2);
	});
});

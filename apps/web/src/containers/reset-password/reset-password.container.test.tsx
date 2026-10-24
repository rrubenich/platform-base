import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import { ResetPasswordContainer } from "./reset-password.container";
import { parseResetPasswordSearch } from "./reset-password.search";

let search: { token?: string; error?: string } = {};

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => search,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		resetPassword: vi.fn(),
		updateUser: vi.fn(),
		useSession: () => ({ data: null }),
	},
}));

function renderReset() {
	const queryClient = new QueryClient();
	const clear = vi.spyOn(queryClient, "clear");
	render(
		<QueryClientProvider client={queryClient}>
			<ResetPasswordContainer />
		</QueryClientProvider>,
	);
	return { clear };
}

async function choose(password: string, confirm = password) {
	await userEvent.type(screen.getByLabelText("New password"), password);
	await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
	await userEvent.click(
		screen.getByRole("button", { name: "Set new password" }),
	);
}

describe("ResetPasswordContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		search = { token: "reset-token" };
	});

	it("sets the new password with the link's token, then offers to sign in", async () => {
		vi.mocked(authClient.resetPassword).mockResolvedValue({
			data: { status: true },
			error: null,
		} as never);
		const { clear } = renderReset();

		await choose("brand-new-pass");

		expect(authClient.resetPassword).toHaveBeenCalledWith({
			newPassword: "brand-new-pass",
			token: "reset-token",
		});
		expect(await screen.findByText("Password updated")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/sign-in",
		);
		expect(clear).toHaveBeenCalled();
	});

	it("checks the confirmation and length before asking the server", async () => {
		renderReset();

		await choose("brand-new-pass", "something-else");
		expect(
			await screen.findByText("The passwords don't match."),
		).toBeInTheDocument();

		await userEvent.clear(screen.getByLabelText("New password"));
		await userEvent.clear(screen.getByLabelText("Confirm new password"));
		await choose("short");
		expect(
			await screen.findByText("Use at least 8 characters."),
		).toBeInTheDocument();
		expect(authClient.resetPassword).not.toHaveBeenCalled();
	});

	it.each([
		["an invalid link", { error: "INVALID_TOKEN" }],
		["no token", {}],
	])("offers a new link for %s", (_case, linkSearch) => {
		search = linkSearch;
		renderReset();

		expect(screen.getByText("This link doesn't work")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Send a new link" }),
		).toHaveAttribute("href", "/forgot-password");
		expect(screen.queryByLabelText("New password")).toBeNull();
	});

	it("turns into the invalid-link message when the token was used meanwhile", async () => {
		vi.mocked(authClient.resetPassword).mockResolvedValue({
			data: null,
			error: { status: 400, code: "INVALID_TOKEN", message: "Invalid token" },
		} as never);
		renderReset();

		await choose("brand-new-pass");

		expect(
			await screen.findByText("This link doesn't work"),
		).toBeInTheDocument();
	});
});

describe("parseResetPasswordSearch", () => {
	it("keeps only a string token and error", () => {
		expect(
			parseResetPasswordSearch({ token: "t", error: "INVALID_TOKEN", x: 1 }),
		).toEqual({ token: "t", error: "INVALID_TOKEN" });
		expect(parseResetPasswordSearch({ token: 3 })).toEqual({});
	});
});

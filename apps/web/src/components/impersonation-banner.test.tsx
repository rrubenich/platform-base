import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import { ImpersonationBanner } from "./impersonation-banner";

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: vi.fn(),
		admin: { stopImpersonating: vi.fn() },
	},
}));

function withSession(impersonatedBy: string | null) {
	vi.mocked(authClient.useSession).mockReturnValue({
		data: {
			session: { id: "s1", impersonatedBy },
			user: { id: "user-2", name: "Jane Doe", email: "jane@example.com" },
		},
	} as never);
}

describe("ImpersonationBanner", () => {
	const assign = vi.fn();

	beforeEach(() => {
		assign.mockReset();
		vi.stubGlobal("location", { ...window.location, assign });
		vi.mocked(authClient.admin.stopImpersonating).mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("stays hidden in a normal session", () => {
		withSession(null);

		render(<ImpersonationBanner />);

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("says whose account the admin is acting in", () => {
		withSession("admin-1");

		render(<ImpersonationBanner />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"You're signed in as Jane Doe (jane@example.com).",
		);
	});

	it("returns the admin to the users list when they stop", async () => {
		withSession("admin-1");
		vi.mocked(authClient.admin.stopImpersonating).mockResolvedValue({
			data: {},
			error: null,
		} as never);

		render(<ImpersonationBanner />);
		await userEvent.click(
			screen.getByRole("button", { name: "Stop impersonating" }),
		);

		await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin/users"));
	});

	it("stays put if stopping fails", async () => {
		withSession("admin-1");
		vi.mocked(authClient.admin.stopImpersonating).mockResolvedValue({
			data: null,
			error: { status: 500, message: "boom" },
		} as never);

		render(<ImpersonationBanner />);
		const button = screen.getByRole("button", { name: "Stop impersonating" });
		await userEvent.click(button);

		await waitFor(() => expect(button).toBeEnabled());
		expect(assign).not.toHaveBeenCalled();
	});
});

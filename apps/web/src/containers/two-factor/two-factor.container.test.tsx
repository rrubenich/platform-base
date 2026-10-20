import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { TwoFactorContainer } from "./two-factor.container";

const navigate = vi.fn();

let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => search,
	useNavigate: () => navigate,
	Link: ({
		to,
		search,
		children,
	}: {
		to: string;
		search?: Record<string, string>;
		children: React.ReactNode;
	}) => (
		<a
			href={`${to}${search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : ""}`}
		>
			{children}
		</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		twoFactor: {
			verifyTotp: vi.fn(),
			verifyOtp: vi.fn(),
			verifyBackupCode: vi.fn(),
			sendOtp: vi.fn(),
		},
		useSession: () => ({ data: null }),
		updateUser: vi.fn(),
	},
}));

const ok = { data: {}, error: null } as never;

describe("TwoFactorContainer", () => {
	beforeEach(() => {
		search = {};
		navigate.mockReset();
		for (const fn of Object.values(authClient.twoFactor)) {
			vi.mocked(fn).mockReset();
		}
	});

	describe("authenticator app", () => {
		it("verifies the code and navigates home", async () => {
			vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue(ok);

			render(<TwoFactorContainer />);

			await userEvent.type(screen.getByLabelText("Code"), "123456");
			await userEvent.click(screen.getByRole("button", { name: "Verify" }));

			expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
				code: "123456",
				trustDevice: false,
			});
			expect(navigate).toHaveBeenCalledWith({ to: "/" });
		});

		it("can trust the device", async () => {
			vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue(ok);

			render(<TwoFactorContainer />);

			await userEvent.click(
				screen.getByRole("checkbox", { name: "Trust this device for 30 days" }),
			);
			await userEvent.type(screen.getByLabelText("Code"), "123456");
			await userEvent.click(screen.getByRole("button", { name: "Verify" }));

			expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
				code: "123456",
				trustDevice: true,
			});
		});

		it("shows the error and stays on the page when the code is wrong", async () => {
			vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
				data: null,
				error: { message: "Invalid code" },
			} as never);

			render(<TwoFactorContainer />);

			await userEvent.type(screen.getByLabelText("Code"), "000000");
			await userEvent.click(screen.getByRole("button", { name: "Verify" }));

			expect(await screen.findByText("Invalid code")).toBeInTheDocument();
			expect(navigate).not.toHaveBeenCalled();
		});
	});

	describe("email code", () => {
		it("sends a code, then verifies it", async () => {
			vi.mocked(authClient.twoFactor.sendOtp).mockResolvedValue(ok);
			vi.mocked(authClient.twoFactor.verifyOtp).mockResolvedValue(ok);

			render(<TwoFactorContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a code instead" }),
			);
			expect(screen.queryByLabelText("Code")).not.toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a code" }),
			);
			expect(authClient.twoFactor.sendOtp).toHaveBeenCalled();
			expect(
				await screen.findByText("We sent a code to your email."),
			).toBeInTheDocument();

			await userEvent.type(screen.getByLabelText("Code"), "654321");
			await userEvent.click(screen.getByRole("button", { name: "Verify" }));

			expect(authClient.twoFactor.verifyOtp).toHaveBeenCalledWith({
				code: "654321",
				trustDevice: false,
			});
			expect(navigate).toHaveBeenCalledWith({ to: "/" });
		});

		it("shows an error when the code can't be sent", async () => {
			vi.mocked(authClient.twoFactor.sendOtp).mockResolvedValue({
				data: null,
				error: {},
			} as never);

			render(<TwoFactorContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a code instead" }),
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Email me a code" }),
			);

			expect(
				await screen.findByText("Could not send the code. Please try again."),
			).toBeInTheDocument();
		});
	});

	it("verifies a backup code", async () => {
		vi.mocked(authClient.twoFactor.verifyBackupCode).mockResolvedValue(ok);

		render(<TwoFactorContainer />);

		await userEvent.click(
			screen.getByRole("button", { name: "Use a backup code" }),
		);
		await userEvent.type(screen.getByLabelText("Backup code"), "abcde-12345");
		await userEvent.click(screen.getByRole("button", { name: "Verify" }));

		expect(authClient.twoFactor.verifyBackupCode).toHaveBeenCalledWith({
			code: "abcde-12345",
			trustDevice: false,
		});
		expect(navigate).toHaveBeenCalledWith({ to: "/" });
	});

	it("links back to sign in", () => {
		render(<TwoFactorContainer />);

		expect(
			screen.getByRole("link", { name: "Back to sign in" }),
		).toHaveAttribute("href", "/sign-in");
	});

	it("navigates to the requested page after verifying", async () => {
		search = { redirect: "/invitations/i1" };
		vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue(ok);

		render(<TwoFactorContainer />);

		await userEvent.type(screen.getByLabelText("Code"), "123456");
		await userEvent.click(screen.getByRole("button", { name: "Verify" }));

		expect(navigate).toHaveBeenCalledWith({ to: "/invitations/i1" });
	});

	it("keeps the redirect on the link to sign-in", () => {
		search = { redirect: "/invitations/i1" };

		render(<TwoFactorContainer />);

		expect(
			screen.getByRole("link", { name: "Back to sign in" }),
		).toHaveAttribute("href", "/sign-in?redirect=%2Finvitations%2Fi1");
	});
});

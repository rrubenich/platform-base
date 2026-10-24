import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import { SecurityContainer } from "./security.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

const session = vi.hoisted(() => ({
	current: {
		data: null as null | {
			user: { id: string; twoFactorEnabled: boolean };
		},
		isPending: false,
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => session.current,
		listAccounts: vi.fn(),
		updateUser: vi.fn(),
		twoFactor: {
			enable: vi.fn(),
			disable: vi.fn(),
			verifyTotp: vi.fn(),
			generateBackupCodes: vi.fn(),
		},
	},
}));

const TOTP_URI =
	"otpauth://totp/Platform Base:jane%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Platform Base";
const BACKUP_CODES = ["aaaaa-11111", "bbbbb-22222"];

function signedIn({ twoFactorEnabled = false } = {}) {
	session.current = {
		data: { user: { id: "user-1", twoFactorEnabled } },
		isPending: false,
	};
}

function withAccounts(...providerIds: string[]) {
	vi.mocked(authClient.listAccounts).mockResolvedValue({
		data: providerIds.map((providerId) => ({ providerId })),
		error: null,
	} as never);
}

function renderSecurity() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<SecurityContainer />
		</QueryClientProvider>,
	);
}

async function confirmPassword(password = "s3cret-pass") {
	await userEvent.type(await screen.findByLabelText("Password"), password);
	await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("SecurityContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		vi.mocked(authClient.listAccounts).mockReset();
		for (const fn of Object.values(authClient.twoFactor)) {
			vi.mocked(fn).mockReset();
		}
	});

	it("sends signed-out visitors to sign in", async () => {
		session.current = { data: null, isPending: false };

		renderSecurity();

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }),
		);
	});

	it("explains that accounts without a password can't use 2FA", async () => {
		signedIn();
		withAccounts("google");

		renderSecurity();

		expect(
			await screen.findByText(/Your account has no password/),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Turn on" }),
		).not.toBeInTheDocument();
	});

	it("turns on 2FA: password, QR code, verification, then backup codes", async () => {
		signedIn();
		withAccounts("credential");
		vi.mocked(authClient.twoFactor.enable).mockResolvedValue({
			data: { method: "totp", totpURI: TOTP_URI, backupCodes: BACKUP_CODES },
			error: null,
		} as never);
		vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
			data: {},
			error: null,
		} as never);

		renderSecurity();

		expect(
			await screen.findByText("Two-factor authentication is off."),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
		await confirmPassword();

		expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
			password: "s3cret-pass",
			method: "totp",
		});
		expect(
			await screen.findByTitle("QR code for your authenticator app"),
		).toBeInTheDocument();
		expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();

		await userEvent.type(screen.getByLabelText("Code"), "123456");
		await userEvent.click(
			screen.getByRole("button", { name: "Verify and turn on" }),
		);

		expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
			code: "123456",
		});
		expect(
			await screen.findByText("Save your backup codes"),
		).toBeInTheDocument();
		for (const code of BACKUP_CODES) {
			expect(screen.getByText(code)).toBeInTheDocument();
		}

		await userEvent.click(
			screen.getByRole("button", { name: "I've saved them" }),
		);
		expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument();
	});

	it("keeps the QR code up when the verification code is wrong", async () => {
		signedIn();
		withAccounts("credential");
		vi.mocked(authClient.twoFactor.enable).mockResolvedValue({
			data: { method: "totp", totpURI: TOTP_URI, backupCodes: BACKUP_CODES },
			error: null,
		} as never);
		vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValue({
			data: null,
			error: { message: "Invalid code" },
		} as never);

		renderSecurity();

		await userEvent.click(
			await screen.findByRole("button", { name: "Turn on" }),
		);
		await confirmPassword();
		await userEvent.type(await screen.findByLabelText("Code"), "000000");
		await userEvent.click(
			screen.getByRole("button", { name: "Verify and turn on" }),
		);

		expect(await screen.findByText("Invalid code")).toBeInTheDocument();
		expect(
			screen.getByTitle("QR code for your authenticator app"),
		).toBeInTheDocument();
	});

	it("shows the error when the password is wrong", async () => {
		signedIn();
		withAccounts("credential");
		vi.mocked(authClient.twoFactor.enable).mockResolvedValue({
			data: null,
			error: { message: "Invalid password" },
		} as never);

		renderSecurity();

		await userEvent.click(
			await screen.findByRole("button", { name: "Turn on" }),
		);
		await confirmPassword("wrong-pass");

		expect(await screen.findByText("Invalid password")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
	});

	describe("with 2FA on", () => {
		beforeEach(() => {
			signedIn({ twoFactorEnabled: true });
			withAccounts("credential");
		});

		it("turns it off after confirming the password", async () => {
			vi.mocked(authClient.twoFactor.disable).mockResolvedValue({
				data: { status: true },
				error: null,
			} as never);

			renderSecurity();

			expect(
				await screen.findByText("Two-factor authentication is on."),
			).toBeInTheDocument();
			await userEvent.click(screen.getByRole("button", { name: "Turn off" }));
			await confirmPassword();

			expect(authClient.twoFactor.disable).toHaveBeenCalledWith({
				password: "s3cret-pass",
			});
		});

		it("generates and shows new backup codes", async () => {
			vi.mocked(authClient.twoFactor.generateBackupCodes).mockResolvedValue({
				data: { status: true, backupCodes: ["ccccc-33333"] },
				error: null,
			} as never);

			renderSecurity();

			await userEvent.click(
				await screen.findByRole("button", {
					name: "Generate new backup codes",
				}),
			);
			await confirmPassword();

			expect(authClient.twoFactor.generateBackupCodes).toHaveBeenCalledWith({
				password: "s3cret-pass",
			});
			expect(await screen.findByText("ccccc-33333")).toBeInTheDocument();
		});

		it("can cancel the password prompt", async () => {
			renderSecurity();

			await userEvent.click(
				await screen.findByRole("button", { name: "Turn off" }),
			);
			await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(
				screen.getByText("Two-factor authentication is on."),
			).toBeInTheDocument();
			expect(authClient.twoFactor.disable).not.toHaveBeenCalled();
		});
	});
});

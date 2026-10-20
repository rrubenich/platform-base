import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { m } from "@workspace/i18n/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { OnboardingContainer } from "./onboarding.container";

const navigate = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: null }),
		updateUser: vi.fn(),
		organization: {
			create: vi.fn(),
			checkSlug: vi.fn(),
			listUserInvitations: vi.fn(),
			acceptInvitation: vi.fn(),
		},
	},
}));

const org = vi.mocked(authClient.organization);

function renderOnboarding() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<OnboardingContainer />
		</QueryClientProvider>,
	);
}

describe("OnboardingContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(org)) vi.mocked(fn).mockReset();
		org.checkSlug.mockResolvedValue({
			data: { status: true },
			error: null,
		} as never);
		org.listUserInvitations.mockResolvedValue({
			data: [],
			error: null,
		} as never);
	});

	it("derives the slug from the name", async () => {
		renderOnboarding();

		await userEvent.type(
			screen.getByLabelText(m.onboarding_name_label()),
			"Acme Inc",
		);

		expect(screen.getByLabelText(m.onboarding_slug_label())).toHaveValue(
			"acme-inc",
		);
	});

	it("flags a taken slug and blocks submitting", async () => {
		org.checkSlug.mockResolvedValue({
			data: null,
			error: { code: "SLUG_IS_TAKEN", status: 400, message: "taken" },
		} as never);
		renderOnboarding();

		await userEvent.type(
			screen.getByLabelText(m.onboarding_name_label()),
			"Acme Inc",
		);

		expect(await screen.findByText(m.onboarding_slug_taken())).toBeVisible();
		expect(org.checkSlug).toHaveBeenCalledWith({ slug: "acme-inc" });
		expect(
			screen.getByRole("button", { name: m.onboarding_create_submit() }),
		).toBeDisabled();
	});

	it("creates the organization and goes home", async () => {
		org.create.mockResolvedValue({ data: { id: "o1" }, error: null } as never);
		renderOnboarding();

		await userEvent.type(
			screen.getByLabelText(m.onboarding_name_label()),
			"Acme Inc",
		);
		const submit = screen.getByRole("button", {
			name: m.onboarding_create_submit(),
		});
		await waitFor(() => expect(submit).toBeEnabled());
		await userEvent.click(submit);

		expect(org.create).toHaveBeenCalledWith({
			name: "Acme Inc",
			slug: "acme-inc",
		});
		await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
	});

	it("shows an API error inline", async () => {
		org.create.mockResolvedValue({
			data: null,
			error: { status: 400, message: "Nope, sorry" },
		} as never);
		renderOnboarding();

		await userEvent.type(
			screen.getByLabelText(m.onboarding_name_label()),
			"Acme Inc",
		);
		const submit = screen.getByRole("button", {
			name: m.onboarding_create_submit(),
		});
		await waitFor(() => expect(submit).toBeEnabled());
		await userEvent.click(submit);

		expect(await screen.findByText("Nope, sorry")).toBeVisible();
		expect(navigate).not.toHaveBeenCalled();
	});

	describe("pending invitations", () => {
		beforeEach(() => {
			org.listUserInvitations.mockResolvedValue({
				data: [
					{
						id: "inv1",
						organizationName: "Globex",
						role: "admin",
						status: "pending",
					},
					{
						id: "inv2",
						organizationName: "Old Co",
						role: "member",
						status: "canceled",
					},
				],
				error: null,
			} as never);
		});

		it("lists pending ones and accepts", async () => {
			org.acceptInvitation.mockResolvedValue({
				data: {},
				error: null,
			} as never);
			renderOnboarding();

			expect(await screen.findByText("Globex")).toBeVisible();
			expect(screen.getByText(m.onboarding_role_admin())).toBeVisible();
			expect(screen.queryByText("Old Co")).not.toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("button", { name: m.onboarding_invitation_accept() }),
			);

			expect(org.acceptInvitation).toHaveBeenCalledWith({
				invitationId: "inv1",
			});
			await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
		});

		it("toasts a failed accept", async () => {
			org.acceptInvitation.mockResolvedValue({
				data: null,
				error: {
					status: 400,
					code: "ALREADY_IN_AN_ORGANIZATION",
					message: "You already belong to an organization.",
				},
			} as never);
			renderOnboarding();

			await userEvent.click(
				await screen.findByRole("button", {
					name: m.onboarding_invitation_accept(),
				}),
			);

			await waitFor(() =>
				expect(toast.error).toHaveBeenCalledWith(
					"You already belong to an organization.",
				),
			);
			expect(navigate).not.toHaveBeenCalled();
		});
	});
});

import { LocaleSwitcher } from "@/components/locale-switcher";
import { CreateOrganizationForm } from "./components/create-organization-form";
import { PendingInvitations } from "./components/pending-invitations";
import { useOnboardingContext } from "./onboarding.context";

export function OnboardingPage() {
	const {
		invitations,
		acceptingId,
		accept,
		createOrganization,
		setSlug,
		slugTaken,
	} = useOnboardingContext();

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col gap-4">
				{invitations.length > 0 && (
					<PendingInvitations
						invitations={invitations}
						acceptingId={acceptingId}
						onAccept={accept}
					/>
				)}
				<CreateOrganizationForm
					onSubmit={createOrganization}
					onSlugChange={setSlug}
					slugTaken={slugTaken}
				/>
				<LocaleSwitcher />
			</div>
		</div>
	);
}

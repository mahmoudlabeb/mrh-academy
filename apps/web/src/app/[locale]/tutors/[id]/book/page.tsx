import { TutorProfileScreen } from "@/components/blueprint/MarketplaceScreens";
import { AuthenticatedGuestRoute } from "@/components/shared/AuthenticatedGuestRoute";

export default function Page() {
  return (
    <AuthenticatedGuestRoute>
      <TutorProfileScreen booking />
    </AuthenticatedGuestRoute>
  );
}

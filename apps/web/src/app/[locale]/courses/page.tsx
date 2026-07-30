import { CourseCatalogScreen } from "@/components/blueprint/MarketplaceScreens";
import { AuthenticatedGuestRoute } from "@/components/shared/AuthenticatedGuestRoute";

export default function Page() {
  return (
    <AuthenticatedGuestRoute>
      <CourseCatalogScreen />
    </AuthenticatedGuestRoute>
  );
}

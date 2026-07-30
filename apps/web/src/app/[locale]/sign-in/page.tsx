import { SignInScreen } from "@/components/blueprint/AuthScreens";
import { AuthenticatedGuestRoute } from "@/components/shared/AuthenticatedGuestRoute";

export default function LocaleSignInPage() {
  return (
    <AuthenticatedGuestRoute>
      <SignInScreen />
    </AuthenticatedGuestRoute>
  );
}

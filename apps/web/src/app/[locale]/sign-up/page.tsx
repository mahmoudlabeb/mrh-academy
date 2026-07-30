import { SignUpScreen } from "@/components/blueprint/AuthScreens";
import { AuthenticatedGuestRoute } from "@/components/shared/AuthenticatedGuestRoute";

export default function LocaleSignUpPage() {
  return (
    <AuthenticatedGuestRoute>
      <SignUpScreen />
    </AuthenticatedGuestRoute>
  );
}

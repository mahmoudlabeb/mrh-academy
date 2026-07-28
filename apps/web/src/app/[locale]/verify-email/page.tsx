import { Suspense } from "react";
import VerifyEmailPage from "../../verify-email/page";

export default function LocaleVerifyEmailPage() {
  return (
    <Suspense fallback={<main aria-busy="true" />}>
      <VerifyEmailPage />
    </Suspense>
  );
}

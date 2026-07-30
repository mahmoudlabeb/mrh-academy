"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { authenticatedGuestDestination } from "@/lib/workspace-routing";

function RedirectStatus() {
  const { lang } = useLanguage();

  return (
    <main className="workspace-gate" aria-busy="true">
      <p role="status" aria-live="polite">
        {lang === "ar"
          ? "جارٍ فتح الوجهة داخل مساحة عملك…"
          : "Opening this destination in your workspace…"}
      </p>
    </main>
  );
}

function AuthenticatedGuestRouteContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [sourceHash, setSourceHash] = useState<string | null>(null);
  const query = searchParams.toString();
  const destination =
    user && sourceHash !== null
      ? authenticatedGuestDestination(
          `${pathname}${query ? `?${query}` : ""}${sourceHash}`,
          user.role,
        )
      : null;

  useEffect(() => {
    const syncHash = () => setSourceHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (isLoading || sourceHash === null || destination) {
    return <RedirectStatus />;
  }
  return children;
}

export function AuthenticatedGuestRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RedirectStatus />}>
      <AuthenticatedGuestRouteContent>
        {children}
      </AuthenticatedGuestRouteContent>
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your email…");
  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setMessage("This verification link is incomplete.");
      return;
    }
    apiClient
      .post("/auth/verify-email", { token })
      .then(() => {
        setMessage("Email verified. You can now sign in.");
        setTimeout(() => router.push("/login"), 1200);
      })
      .catch(() => setMessage("This verification link is invalid or expired."));
  }, [params, router]);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <p>{message}</p>
    </main>
  );
}

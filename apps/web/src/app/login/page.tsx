"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";
import Link from "next/link";
import { comingSoon } from "@/lib/coming-soon";
import { useLanguage } from "@/contexts/language-context";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirect");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const user = await login(data.email, data.password);
      return user;
    },
    onSuccess: (user) => {
      const requestedRedirect = new URLSearchParams(window.location.search).get(
        "redirect",
      );
      const roleHome =
        user.role === "tutor"
          ? "/tutor"
          : user.role === "admin" || user.role === "subadmin"
            ? "/admin"
            : "/student";
      const safeRedirect =
        requestedRedirect?.startsWith("/") &&
        !requestedRedirect.startsWith("//")
          ? requestedRedirect
          : null;
      router.push(safeRedirect || roleHome);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full animate-float opacity-10" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full animate-float opacity-10" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)', animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold logo-font" style={{ color: '#D4A353' }}>Mr.H Academy</span>
          </Link>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{isAr ? 'مرحباً بعودتك' : 'Welcome back'}</h1>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>{isAr ? 'سجل الدخول إلى حسابك' : 'Sign in to your account'}</p>
        </div>

        <div className="card-gold p-8 animate-scale-in">
          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="flex flex-col gap-5"
          >
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {isAr ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                {...register("email")}
                type="email"
                dir="ltr"
                placeholder="you@example.com"
                className="input-field"
              />
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {isAr ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                {...register("password")}
                type="password"
                placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter your password'}
                className="input-field"
              />
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {mutation.error && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#ef4444' }}>
                  {(
                    mutation.error as {
                      response?: { data?: { message?: string } };
                    }
                  )?.response?.data?.message ||
                    (isAr ? 'فشل تسجيل الدخول. تحقق من بيانات الاعتماد الخاصة بك.' : 'Sign in failed. Check your credentials and try again.')}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full py-3.5"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isAr ? 'جاري الدخول...' : 'Signing in...'}
                </span>
              ) : (
                (isAr ? 'تسجيل الدخول' : 'Sign in')
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'var(--border-color)' }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                  {isAr ? 'أو تابع باستخدام' : 'Or continue with'}
                </span>
              </div>
            </div>

            <a
              href={`${getApiBaseUrl()}/auth/google`}
              className="btn-secondary w-full justify-center py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isAr ? 'تسجيل الدخول عبر Google' : 'Continue with Google'}
            </a>

            <button
              type="button"
              onClick={() => comingSoon('تسجيل الدخول بـ Facebook')}
              className="btn-secondary w-full justify-center py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {isAr ? 'متابعة بـ Facebook' : 'Continue with Facebook'}
            </button>

            <button
              type="button"
              onClick={() => comingSoon('تسجيل الدخول بـ Apple')}
              className="btn-secondary w-full justify-center py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97c-1.41.02-1.86-.84-3.45-.84-1.59 0-2.08.84-3.45.84-1.41.01-2.42-1.23-3.29-2.48-.78-1.12-1.64-2.79-.35-4.72.69-.98 1.88-1.22 2.67-.16.61.82.54 1.52.84 1.92.63.84 1.57 1.28 2.38.95.5-.2.93-.49.93-1.12 0-.14-.02-.3-.04-.49-.62-.22-1.35-.47-2.05-.73-.67-.25-1.13-.5-1.13-1.12 0-.63.43-.86.88-1.04.62-.25 1.43-.52 2.2-.78.55-.19 1.03-.37 1.43-.37.4 0 .77.18.1 .37-.04.02-.08.04-.11.05-.07.03-.12.06-.12.08 0 .02.02 .04 .07 .06 .06 .02.13 .04.21 .06 .09 .02.19 .05.29.07 .1 .02.21 .05.31.08 .09 .03.19 .05.28.07 .05 .01.1.03.15.04 .02.01.04 .01.06.02.01.00.03.01.04.01-.01.01-.02.01-.03.02-.14.06-.28.12-.41.18-.57.23-1.14.46-1.71.69-.76.31-1.53.63-2.28.95-.29.12-.55.24-.79.36-.1.05-.19.09-.27.12-.05.03-.1.05-.14.07-.04.03-.08.06-.12.1-.03.03-.06.06-.09.1-.03.03-.05.07-.08.11-.02.04-.04.09-.05.14" />
              </svg>
              {isAr ? 'متابعة بـ Apple' : 'Continue with Apple'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}{" "}
          <Link href={requestedRedirect ? `/register?redirect=${encodeURIComponent(requestedRedirect)}` : "/register"} className="link">
            {isAr ? 'إنشاء حساب' : 'Create account'}
          </Link>
        </p>
      </div>
    </div>
  );
}

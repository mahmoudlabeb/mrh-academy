"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

const registerSchema = z
  .object({
    email: z.string().email("البريد الإلكتروني غير صحيح"),
    password: z.string().min(15, "15 حرفًا على الأقل").max(128, "128 حرفًا كحد أقصى"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "الاسم الأول مطلوب"),
    lastName: z.string().min(1, "الاسم الأخير مطلوب"),
    role: z.literal("student"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const { register: registerUser } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "student" },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const user = await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "student",
      });
      return user;
    },
    onSuccess: (user) => {
      router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full animate-float opacity-10" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full animate-float opacity-10" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)', animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-lg animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold logo-font" style={{ color: '#D4A353' }}>Mr.H Academy</span>
          </Link>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>
            {isAr ? 'إنشاء حساب جديد' : 'Create your account'}
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
            {isAr ? 'انضم إلى Mr.H Academy اليوم' : 'Join Mr.H Academy today'}
          </p>
        </div>

        <div className="card-gold p-8 animate-scale-in">
          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                  {isAr ? 'الاسم الأول' : 'First name'}
                </label>
                <input
                  {...register("firstName")}
                  placeholder={isAr ? 'محمد' : 'First name'}
                  className="input-field"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                  {isAr ? 'الاسم الأخير' : 'Last name'}
                </label>
                <input
                  {...register("lastName")}
                  placeholder={isAr ? 'أحمد' : 'Last name'}
                  className="input-field"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <input
                  {...register("password")}
                  type="password"
                  placeholder={isAr ? '15 حرفاً على الأقل' : 'At least 15 characters'}
                  className="input-field"
                />
                {errors.password && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
                </label>
                <input
                  {...register("confirmPassword")}
                  type="password"
                  placeholder={isAr ? 'أعد كتابة كلمة المرور' : 'Repeat your password'}
                  className="input-field"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <input type="hidden" value="student" {...register("role")} />

            <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(212, 163, 83,0.1)', border: '1px solid rgba(212, 163, 83,0.2)', color: 'var(--text-main)' }}>
              <p className="font-semibold">{isAr ? 'إنشاء حساب طالب' : 'Create a student account'}</p>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'هل تريد التدريس في Mr.H Academy؟ أنشئ حساب طالب أولاً، ثم قدم طلب التسجيل كمدرس لمراجعته من قبل الإدارة.' : 'Want to teach at Mr.H Academy? Create your account first, then submit a tutor application for review.'}
              </p>
              <Link
                href="/become-teacher"
                className="mt-3 inline-flex font-semibold link"
              >
                {isAr ? 'قدم طلب التسجيل كمدرس ←' : 'Apply to become a tutor →'}
              </Link>
            </div>

            {mutation.error && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#ef4444' }}>
                  {(
                    mutation.error as {
                      response?: { data?: { message?: string } };
                    }
                  )?.response?.data?.message || "فشل التسجيل"}
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
                  {isAr ? 'جاري إنشاء الحساب...' : 'Creating account...'}
                </span>
              ) : (
                (isAr ? 'إنشاء الحساب' : 'Create account')
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
              {isAr ? 'التسجيل عبر Google' : 'Continue with Google'}
            </a>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{" "}
          <Link href="/login" className="link">
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";

function useCopy() {
  const { lang } = useLanguage();
  return {
    lang,
    t: (ar: string, en: string) => (lang === "ar" ? ar : en),
  };
}

function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { lang } = useCopy();

  return (
    <main className="blueprint-auth">
      <Link className="blueprint-auth__brand" href={`/${lang}`}>
        <span aria-hidden="true">M</span>
        <strong>MRH Academy</strong>
      </Link>
      <section className="blueprint-auth__card">
        <p className="blueprint-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}

function mutationError(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

function GoogleAuthButton() {
  const { t } = useCopy();
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a className="blueprint-google-auth" href="/api/v1/auth/google">
      <span aria-hidden="true">G</span>
      {t("المتابعة باستخدام Google", "Continue with Google")}
    </a>
  );
}

export function SignInScreen() {
  const { lang, t } = useCopy();
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: (user) => {
      const requested =
        searchParams.get("next") ?? searchParams.get("redirect");
      const safe =
        requested?.startsWith(`/${lang}/`) && !requested.startsWith("//")
          ? requested
          : null;
      const home =
        user.role === "tutor"
          ? `/${lang}/teach`
          : user.role === "admin" || user.role === "subadmin"
            ? `/${lang}/ops`
            : `/${lang}/learn`;
      router.replace(safe ?? home);
    },
  });

  return (
    <AuthFrame
      eyebrow={t("دخول آمن", "Secure access")}
      title={t("مرحباً بعودتك", "Welcome back")}
      description={t(
        "سجّل الدخول للمتابعة من حيث توقفت.",
        "Sign in to continue where you left off.",
      )}
    >
      <GoogleAuthButton />
      <div className="blueprint-auth__divider">
        <span>{t("أو باستخدام البريد الإلكتروني", "or use your email")}</span>
      </div>
      <form
        className="blueprint-auth__form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          {t("البريد الإلكتروني", "Email address")}
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {t("كلمة المرور", "Password")}
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mutation.isError && (
          <p className="blueprint-error" role="alert">
            {mutationError(
              mutation.error,
              t("تعذّر تسجيل الدخول.", "Sign-in failed."),
            )}
          </p>
        )}
        <button className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending
            ? t("جارٍ التحقق…", "Checking…")
            : t("تسجيل الدخول", "Sign in")}
        </button>
      </form>
      <div className="blueprint-auth__links">
        <Link href={`/${lang}/forgot-password`}>
          {t("نسيت كلمة المرور؟", "Forgot password?")}
        </Link>
        <Link href={`/${lang}/sign-up`}>
          {t("إنشاء حساب طالب", "Create learner account")}
        </Link>
      </div>
    </AuthFrame>
  );
}

export function SignUpScreen() {
  const { lang, t } = useCopy();
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [complete, setComplete] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "student",
      }),
    onSuccess: () => setComplete(true),
  });

  return (
    <AuthFrame
      eyebrow={t("حساب الطالب", "Learner account")}
      title={
        complete
          ? t("تحقق من بريدك", "Check your email")
          : t("ابدأ التعلم", "Start learning")
      }
      description={
        complete
          ? t(
              "أُنشئ الحساب. أكمل التحقق من رابط البريد قبل تسجيل الدخول.",
              "Your account was created. Complete email verification before signing in.",
            )
          : t(
              "أنشئ حساباً للوصول إلى الدروس والدورات والمحفظة.",
              "Create an account for lessons, courses, and your wallet.",
            )
      }
    >
      {complete ? (
        <Link
          className="btn-primary blueprint-auth__complete"
          href={`/${lang}/sign-in`}
        >
          {t("العودة لتسجيل الدخول", "Return to sign in")}
        </Link>
      ) : (
        <>
          <GoogleAuthButton />
          <div className="blueprint-auth__divider">
            <span>{t("أو أنشئ حسابًا بالبريد الإلكتروني", "or create an account with email")}</span>
          </div>
          <form
            className="blueprint-auth__form blueprint-auth__form--two"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.password === form.confirm) mutation.mutate();
            }}
          >
          <label>
            {t("الاسم الأول", "First name")}
            <input
              required
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) =>
                setForm({ ...form, firstName: event.target.value })
              }
            />
          </label>
          <label>
            {t("اسم العائلة", "Last name")}
            <input
              required
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) =>
                setForm({ ...form, lastName: event.target.value })
              }
            />
          </label>
          <label className="wide">
            {t("البريد الإلكتروني", "Email address")}
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            {t("كلمة المرور", "Password")}
            <input
              required
              name="password"
              minLength={15}
              maxLength={128}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <small>{t("15 حرفاً على الأقل", "At least 15 characters")}</small>
          </label>
          <label>
            {t("تأكيد كلمة المرور", "Confirm password")}
            <input
              required
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(event) =>
                setForm({ ...form, confirm: event.target.value })
              }
            />
          </label>
          {form.confirm && form.password !== form.confirm && (
            <p className="blueprint-error wide">
              {t("كلمتا المرور غير متطابقتين.", "Passwords do not match.")}
            </p>
          )}
          {mutation.isError && (
            <p className="blueprint-error wide" role="alert">
              {mutationError(
                mutation.error,
                t("تعذّر إنشاء الحساب.", "Account creation failed."),
              )}
            </p>
          )}
          <button
            className="btn-primary wide"
            disabled={mutation.isPending || form.password !== form.confirm}
          >
            {mutation.isPending
              ? t("جارٍ الإنشاء…", "Creating…")
              : t("إنشاء الحساب", "Create account")}
          </button>
          </form>
        </>
      )}
      {!complete && (
        <div className="blueprint-auth__links">
          <Link href={`/${lang}/sign-in`}>
            {t("لديك حساب؟ سجّل الدخول", "Already registered? Sign in")}
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}

export function ForgotPasswordScreen() {
  const { lang, t } = useCopy();
  const [email, setEmail] = useState("");
  const [complete, setComplete] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post("/auth/forgot-password", { email: email.trim() }),
    onSuccess: () => setComplete(true),
  });

  return (
    <AuthFrame
      eyebrow={t("استعادة الحساب", "Account recovery")}
      title={t("إعادة تعيين كلمة المرور", "Reset your password")}
      description={
        complete
          ? t(
              "إذا كان البريد مسجلاً، فقد أرسل الخادم تعليمات الاستعادة.",
              "If the email is registered, the server has sent recovery instructions.",
            )
          : t(
              "أدخل بريد حسابك لطلب رابط آمن.",
              "Enter your account email to request a secure link.",
            )
      }
    >
      {!complete && (
        <form
          className="blueprint-auth__form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            {t("البريد الإلكتروني", "Email address")}
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {mutation.isError && (
            <p className="blueprint-error" role="alert">
              {mutationError(
                mutation.error,
                t("تعذّر إرسال الطلب.", "Recovery request failed."),
              )}
            </p>
          )}
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending
              ? t("جارٍ الإرسال…", "Sending…")
              : t("إرسال رابط الاستعادة", "Send recovery link")}
          </button>
        </form>
      )}
      <div className="blueprint-auth__links">
        <Link href={`/${lang}/sign-in`}>
          {t("العودة لتسجيل الدخول", "Return to sign in")}
        </Link>
      </div>
    </AuthFrame>
  );
}

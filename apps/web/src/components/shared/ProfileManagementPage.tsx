"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { AvatarUploader } from "./AvatarUploader";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import styles from "./ProfileManagementPage.module.css";

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  timezone: string;
  avatarUrl: string | null;
  role: string;
  studentProfile?: unknown | null;
  tutorProfile?: { status?: string } | null;
};

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const phoneCountries = [
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "TR", name: "Türkiye", dial: "+90" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "AU", name: "Australia", dial: "+61" },
] as const;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(
        /(?=.*[A-Z])(?=.*\d)/,
        "Must contain at least one uppercase letter and one digit",
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});
type EmailForm = z.infer<typeof emailSchema>;

type ProfileManagementPageProps = { title: string };

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}

export function ProfileManagementPage({ title }: ProfileManagementPageProps) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("EG");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile>("/users/me");
      return data;
    },
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      timezone: "Africa/Cairo",
    },
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });

  useEffect(() => {
    if (!meQuery.data) return;
    const storedPhone = meQuery.data.phone ?? "";
    const matchingCountry = phoneCountries.find((country) =>
      storedPhone.startsWith(country.dial),
    );
    const phoneDial = matchingCountry?.dial ?? "";
    profileForm.reset({
      firstName: meQuery.data.firstName ?? "",
      lastName: meQuery.data.lastName ?? "",
      phone: phoneDial ? storedPhone.slice(phoneDial.length) : storedPhone,
      timezone: meQuery.data.timezone ?? "Africa/Cairo",
    });
    if (matchingCountry) setPhoneCountry(matchingCountry.code);
    emailForm.reset({ newEmail: meQuery.data.email });
  }, [emailForm, meQuery.data, profileForm]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const { data } = await apiClient.patch<UserProfile>(
        "/users/profile",
        values,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const submitProfile = (values: ProfileForm) => {
    const country =
      phoneCountries.find((item) => item.code === phoneCountry) ??
      phoneCountries[0];
    const digits = (values.phone ?? "")
      .replace(/[^0-9]/g, "")
      .replace(/^0+/, "");
    profileMutation.mutate({
      ...values,
      phone: digits ? `${country.dial}${digits}` : "",
    });
  };
  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const { data } = await apiClient.patch("/users/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      return data;
    },
    onSuccess: () =>
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }),
  });
  const emailMutation = useMutation({
    mutationFn: async (values: EmailForm) => {
      const { data } = await apiClient.patch<UserProfile>(
        "/users/change-email",
        values,
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/users/me");
      return data;
    },
    onSuccess: async () => {
      await apiClient.post("/auth/logout").catch(() => undefined);
      router.push("/login");
    },
  });

  if (meQuery.isLoading) {
    return (
      <div className={styles.stateShell}>
        <span className={styles.loader} aria-hidden="true" />
        <p>{tr("جارٍ تحميل الملف الشخصي", "Loading your profile")}</p>
      </div>
    );
  }
  if (meQuery.error || !meQuery.data) {
    return (
      <div className={styles.stateShell}>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>!</span>
          <p>
            {getErrorMessage(
              meQuery.error,
              tr("تعذر تحميل الملف الشخصي", "Failed to load profile"),
            )}
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => meQuery.refetch()}
          >
            {tr("إعادة المحاولة", "Try again")}
          </button>
        </div>
      </div>
    );
  }

  const user = meQuery.data;
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || "MR";
  const isTutor = user.role.toLowerCase() === "tutor";
  const tutorStatus = user.tutorProfile?.status ?? "pending";
  const statusLabel = isTutor
    ? tutorStatus === "approved"
      ? tr("حساب معتمد", "Approved tutor")
      : tutorStatus === "rejected"
        ? tr("يحتاج إلى مراجعة", "Needs review")
        : tr("قيد المراجعة", "Under review")
    : tr("حساب طالب", "Student account");
  const roleLabel = isTutor ? tr("مدرّس", "Tutor") : tr("طالب", "Student");
  const dashboardHref = isTutor ? "/tutor" : "/student";

  return (
    <div className={styles.page} dir={isAr ? "rtl" : "ltr"}>
      <header className={styles.pageHeader}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              {tr("مساحة الحساب", "ACCOUNT WORKSPACE")}
            </div>
            <h1>
              {isTutor
                ? tr("الملف الشخصي للمدرّس", "Tutor profile")
                : tr("الملف الشخصي للطالب", title || "Student profile")}
            </h1>
            <p>
              {tr(
                "حدّث بياناتك وحافظ على حضورك المهني في الأكاديمية.",
                "Keep your academy profile accurate, private, and ready for your next lesson.",
              )}
            </p>
          </div>
          <Link href={dashboardHref} className={styles.backButton}>
            <span aria-hidden="true">↩</span>
            {tr("العودة إلى لوحة التحكم", "Back to dashboard")}
          </Link>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.profileLayout}>
          <aside className={styles.identityCard}>
            <div className={styles.identityRule} />
            <div className={styles.identityTopline}>
              <span>{tr("هوية الأكاديمية", "ACADEMY IDENTITY")}</span>
              <span className={styles.statusDot} />
            </div>
            <div className={styles.avatarFrame}>
              <AvatarUploader
                currentAvatarUrl={user.avatarUrl ?? undefined}
                initials={initials}
                onSuccess={(avatarUrl) => {
                  queryClient.setQueryData<UserProfile>(["me"], (current) =>
                    current ? { ...current, avatarUrl } : current,
                  );
                }}
              />
            </div>
            <h2>
              {user.firstName} {user.lastName}
            </h2>
            <p className={styles.identityEmail}>{user.email}</p>
            <div className={styles.badgeRow}>
              <span className={styles.roleBadge}>{roleLabel}</span>
              <span className={styles.approvalBadge}>{statusLabel}</span>
            </div>
            <div className={styles.identityDivider} />
            <div className={styles.snapshot}>
              <div>
                <span>{tr("معرّف الحساب", "Account ID")}</span>
                <strong>#{user.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div>
                <span>{tr("المنطقة الزمنية", "Timezone")}</span>
                <strong>{user.timezone || "Africa/Cairo"}</strong>
              </div>
            </div>
            <div className={styles.completeness}>
              <div>
                <span>{tr("اكتمال الملف", "Profile completeness")}</span>
                <strong>80%</strong>
              </div>
              <div className={styles.progressTrack}>
                <span style={{ width: "80%" }} />
              </div>
              <small>
                {tr(
                  "أضف صورة واضحة لتعزيز الثقة",
                  "Add a clear photo to strengthen trust",
                )}
              </small>
            </div>
          </aside>

          <div className={styles.workspace}>
            <section className={styles.surfaceCard}>
              <div className={styles.sectionHeading}>
                <div className={styles.sectionIcon}>✦</div>
                <div>
                  <span>{tr("المعلومات الأساسية", "PROFILE INFORMATION")}</span>
                  <h2>{tr("بياناتك المهنية", "Your professional details")}</h2>
                  <p>
                    {tr(
                      "ستظهر هذه البيانات في حسابك وتساعد الطلاب على التعرف عليك.",
                      "These details keep your account and public presence up to date.",
                    )}
                  </p>
                </div>
              </div>
              <form
                onSubmit={profileForm.handleSubmit(submitProfile)}
                className={styles.formGrid}
              >
                <Field
                  styles={styles}
                  label={tr("الاسم الأول", "First name")}
                  error={profileForm.formState.errors.firstName?.message}
                >
                  <input
                    {...profileForm.register("firstName")}
                    className={styles.input}
                  />
                </Field>
                <Field
                  styles={styles}
                  label={tr("اسم العائلة", "Last name")}
                  error={profileForm.formState.errors.lastName?.message}
                >
                  <input
                    {...profileForm.register("lastName")}
                    className={styles.input}
                  />
                </Field>
                <Field
                  styles={styles}
                  label={tr("رقم الهاتف", "Phone number")}
                  error={profileForm.formState.errors.phone?.message}
                >
                  <div className={styles.phoneGrid}>
                    <select
                      value={phoneCountry}
                      onChange={(event) => setPhoneCountry(event.target.value)}
                      className={styles.input}
                    >
                      {phoneCountries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name} ({country.dial})
                        </option>
                      ))}
                    </select>
                    <input
                      {...profileForm.register("phone")}
                      className={styles.input}
                      placeholder={tr("رقم الهاتف", "Phone number")}
                      inputMode="tel"
                    />
                  </div>
                  <small>
                    {tr(
                      "يُحفظ بصيغة دولية، مثال: +201098936550",
                      "Saved internationally, e.g. +201098936550",
                    )}
                  </small>
                </Field>
                <Field
                  styles={styles}
                  label={tr("المنطقة الزمنية", "Timezone")}
                  error={profileForm.formState.errors.timezone?.message}
                >
                  <input
                    {...profileForm.register("timezone")}
                    className={styles.input}
                  />
                </Field>
                <div className={styles.formFooter}>
                  {profileMutation.error && (
                    <Notice tone="error">
                      {getErrorMessage(
                        profileMutation.error,
                        tr("تعذر تحديث الملف", "Failed to update profile"),
                      )}
                    </Notice>
                  )}
                  {profileMutation.isSuccess && (
                    <Notice tone="success">
                      {tr(
                        "تم تحديث الملف بنجاح",
                        "Profile updated successfully",
                      )}
                    </Notice>
                  )}
                  <button
                    type="submit"
                    disabled={profileMutation.isPending}
                    className={styles.primaryButton}
                  >
                    {profileMutation.isPending
                      ? tr("جارٍ الحفظ...", "Saving...")
                      : tr("حفظ التغييرات", "Save changes")}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.surfaceCard}>
              <div className={styles.sectionHeading}>
                <div className={styles.sectionIcon}>⌁</div>
                <div>
                  <span>{tr("الأمان", "SECURITY")}</span>
                  <h2>{tr("حماية حسابك", "Protect your account")}</h2>
                  <p>
                    {tr(
                      "استخدم كلمة مرور قوية وفريدة للحفاظ على أمان حسابك.",
                      "Use a strong, unique password to keep your account secure.",
                    )}
                  </p>
                </div>
              </div>
              <form
                onSubmit={passwordForm.handleSubmit((values) =>
                  passwordMutation.mutate(values),
                )}
                className={styles.formStack}
              >
                <Field
                  styles={styles}
                  label={tr("كلمة المرور الحالية", "Current password")}
                  error={passwordForm.formState.errors.currentPassword?.message}
                >
                  <input
                    {...passwordForm.register("currentPassword")}
                    type="password"
                    className={styles.input}
                    placeholder={tr(
                      "أدخل كلمة المرور الحالية",
                      "Enter current password",
                    )}
                  />
                </Field>
                <div className={styles.formGrid}>
                  <Field
                    styles={styles}
                    label={tr("كلمة المرور الجديدة", "New password")}
                    error={passwordForm.formState.errors.newPassword?.message}
                  >
                    <input
                      {...passwordForm.register("newPassword")}
                      type="password"
                      className={styles.input}
                      placeholder={tr("8 أحرف على الأقل", "Min. 8 characters")}
                    />
                  </Field>
                  <Field
                    styles={styles}
                    label={tr("تأكيد كلمة المرور", "Confirm new password")}
                    error={
                      passwordForm.formState.errors.confirmNewPassword?.message
                    }
                  >
                    <input
                      {...passwordForm.register("confirmNewPassword")}
                      type="password"
                      className={styles.input}
                      placeholder={tr(
                        "أعد كتابة كلمة المرور",
                        "Repeat password",
                      )}
                    />
                  </Field>
                </div>
                <div className={styles.formFooter}>
                  {passwordMutation.error && (
                    <Notice tone="error">
                      {getErrorMessage(
                        passwordMutation.error,
                        tr(
                          "تعذر تحديث كلمة المرور",
                          "Failed to update password",
                        ),
                      )}
                    </Notice>
                  )}
                  {passwordMutation.isSuccess && (
                    <Notice tone="success">
                      {tr(
                        "تم تحديث كلمة المرور",
                        "Password updated successfully",
                      )}
                    </Notice>
                  )}
                  <button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className={styles.primaryButton}
                  >
                    {passwordMutation.isPending
                      ? tr("جارٍ التحديث...", "Updating...")
                      : tr("تحديث كلمة المرور", "Update password")}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.surfaceCard}>
              <div className={styles.sectionHeading}>
                <div className={styles.sectionIcon}>@</div>
                <div>
                  <span>{tr("جهة التواصل", "CONTACT")}</span>
                  <h2>{tr("البريد الإلكتروني", "Email address")}</h2>
                  <p>
                    {tr(
                      "احتفظ ببريد إلكتروني يمكنك الوصول إليه لاستلام تحديثات الأكاديمية.",
                      "Keep an inbox you can access for academy updates.",
                    )}
                  </p>
                </div>
              </div>
              <form
                onSubmit={emailForm.handleSubmit((values) =>
                  emailMutation.mutate(values),
                )}
                className={styles.formStack}
              >
                <Field
                  styles={styles}
                  label={tr("البريد الإلكتروني الجديد", "New email")}
                  error={emailForm.formState.errors.newEmail?.message}
                >
                  <input
                    {...emailForm.register("newEmail")}
                    className={styles.input}
                  />
                </Field>
                <div className={styles.formFooter}>
                  {emailMutation.error && (
                    <Notice tone="error">
                      {getErrorMessage(
                        emailMutation.error,
                        tr(
                          "تعذر تحديث البريد الإلكتروني",
                          "Failed to update email",
                        ),
                      )}
                    </Notice>
                  )}
                  {emailMutation.isSuccess && (
                    <Notice tone="success">
                      {tr(
                        "تم تحديث البريد الإلكتروني",
                        "Email updated successfully",
                      )}
                    </Notice>
                  )}
                  <button
                    type="submit"
                    disabled={emailMutation.isPending}
                    className={styles.primaryButton}
                  >
                    {emailMutation.isPending
                      ? tr("جارٍ التحديث...", "Updating...")
                      : tr("تحديث البريد الإلكتروني", "Update email")}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.dangerCard}>
              <div>
                <span className={styles.dangerEyebrow}>
                  {tr("منطقة حساسة", "SENSITIVE AREA")}
                </span>
                <h2>{tr("حذف الحساب", "Delete account")}</h2>
                <p>
                  {tr(
                    "سيؤدي هذا إلى إلغاء الدروس النشطة وحذف حسابك نهائيًا.",
                    "This cancels active lessons and permanently deletes your account.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className={styles.dangerButton}
              >
                {tr("حذف الحساب", "Delete account")}
              </button>
            </section>
          </div>
        </section>
      </main>

      {isDeleteOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsDeleteOpen(false)
          }
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <span className={styles.modalWarning}>!</span>
            <h2 id="delete-account-title">
              {tr("تأكيد حذف الحساب", "Confirm account deletion")}
            </h2>
            <p>
              {tr(
                "اكتب DELETE للتأكيد. لا يمكن التراجع عن هذا الإجراء.",
                "Type DELETE to confirm. This action cannot be undone.",
              )}
            </p>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className={styles.input}
              placeholder="DELETE"
              autoFocus
            />
            {deleteMutation.error && (
              <Notice tone="error">
                {getErrorMessage(
                  deleteMutation.error,
                  tr("تعذر حذف الحساب", "Failed to delete account"),
                )}
              </Notice>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeleteConfirmation("");
                }}
                className={styles.secondaryButton}
              >
                {tr("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                disabled={
                  deleteConfirmation !== "DELETE" || deleteMutation.isPending
                }
                onClick={() => deleteMutation.mutate()}
                className={styles.dangerButton}
              >
                {deleteMutation.isPending
                  ? tr("جارٍ الحذف...", "Deleting...")
                  : tr("حذف الحساب", "Delete account")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  styles,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  styles: Record<string, string>;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {error && <small className={styles.fieldError}>{error}</small>}
    </label>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "error";
}) {
  return (
    <div
      className={tone === "success" ? styles.noticeSuccess : styles.noticeError}
      role="status"
    >
      {children}
    </div>
  );
}

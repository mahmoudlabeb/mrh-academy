"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import { CheckIcon, RefreshIcon, SettingsIcon } from "@/components/icons/Icons";

type PlatformSettings = {
  platform_name: string;
  contact_email: string;
  default_lesson_price: number;
  maintenance_mode: boolean;
};

const EMPTY_SETTINGS: PlatformSettings = {
  platform_name: "",
  contact_email: "",
  default_lesson_price: 0,
  maintenance_mode: false,
};

function normalizeSettings(data?: Record<string, unknown>): PlatformSettings {
  const price = Number(data?.default_lesson_price);
  return {
    platform_name: String(data?.platform_name ?? ""),
    contact_email: String(data?.contact_email ?? ""),
    default_lesson_price: Number.isFinite(price) ? price : 0,
    maintenance_mode:
      data?.maintenance_mode === true || data?.maintenance_mode === "true",
  };
}

export default function SettingsTab() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>(EMPTY_SETTINGS);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<Record<string, unknown>>("/admin/settings");
      return normalizeSettings(data);
    },
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: PlatformSettings) => {
      const serialized = {
        platform_name: payload.platform_name.trim(),
        contact_email: payload.contact_email.trim(),
        default_lesson_price: String(payload.default_lesson_price),
        maintenance_mode: String(payload.maintenance_mode),
      };
      return (await apiClient.put("/admin/settings", serialized)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.reset();
    updateMutation.mutate(form);
  }

  function changeForm(update: (current: PlatformSettings) => PlatformSettings) {
    updateMutation.reset();
    setForm(update);
  }

  return (
    <section className="max-w-2xl" aria-labelledby="platform-settings-title">
      <div className="card overflow-hidden">
        <header
          className="flex items-start gap-3 border-b p-5 sm:p-6"
          style={{ borderColor: "var(--border-color)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(212,163,83,.12)", color: "#D4A353" }}
          >
            <SettingsIcon />
          </span>
          <div>
            <h3
              id="platform-settings-title"
              className="text-lg font-bold"
              style={{ color: "var(--text-main)" }}
            >
              {t("إعدادات المنصة", "Platform Settings")}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {t(
                "إدارة الهوية العامة والأسعار وحالة توفر المنصة.",
                "Manage public identity, pricing, and platform availability.",
              )}
            </p>
          </div>
        </header>

        {settingsQuery.isLoading ? (
          <div
            className="space-y-5 p-5 sm:p-6"
            aria-label={t("جاري تحميل الإعدادات", "Loading settings")}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div className="mb-2 h-4 w-1/4 rounded skeleton" />
                <div className="h-11 rounded skeleton" />
              </div>
            ))}
          </div>
        ) : settingsQuery.isError ? (
          <div className="p-5 sm:p-6">
            <div
              role="alert"
              className="rounded-xl border p-5 text-center"
              style={{
                borderColor: "rgba(239,68,68,.35)",
                background: "rgba(239,68,68,.06)",
              }}
            >
              <p className="text-sm font-semibold text-red-500">
                {t(
                  "تعذر تحميل إعدادات المنصة.",
                  "Platform settings could not be loaded.",
                )}
              </p>
              <button
                type="button"
                onClick={() => settingsQuery.refetch()}
                className="btn-secondary mt-4 min-h-10"
              >
                <RefreshIcon className="h-4 w-4" />
                {t("إعادة المحاولة", "Try again")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6">
            <label
              className="block text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              {t("اسم المنصة", "Platform Name")}
              <input
                className="input-field mt-1.5"
                value={form.platform_name}
                onChange={(event) =>
                  changeForm((current) => ({
                    ...current,
                    platform_name: event.target.value,
                  }))
                }
              />
            </label>

            <label
              className="block text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              {t("البريد الإلكتروني للتواصل", "Contact Email")}
              <input
                className="input-field mt-1.5"
                type="email"
                value={form.contact_email}
                onChange={(event) =>
                  changeForm((current) => ({
                    ...current,
                    contact_email: event.target.value,
                  }))
                }
              />
            </label>

            <label
              className="block text-sm font-medium"
              style={{ color: "var(--text-main)" }}
            >
              {t("سعر الدرس الافتراضي", "Default Lesson Price")}
              <input
                className="input-field mt-1.5"
                type="number"
                min={0}
                step={0.5}
                value={form.default_lesson_price}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  changeForm((current) => ({
                    ...current,
                    default_lesson_price: Number.isFinite(next) ? next : 0,
                  }));
                }}
              />
            </label>

            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--bg-light)",
              }}
            >
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {t("وضع الصيانة", "Maintenance Mode")}
                  </span>
                  <span
                    className="mt-1 block text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t(
                      "عند التفعيل، ستظهر صفحة الصيانة للمستخدمين.",
                      "When enabled, users will see a maintenance page.",
                    )}
                  </span>
                </span>
                <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={form.maintenance_mode}
                    onChange={(event) =>
                      changeForm((current) => ({
                        ...current,
                        maintenance_mode: event.target.checked,
                      }))
                    }
                    className="peer sr-only"
                  />
                  <span
                    className="absolute inset-0 rounded-full border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#D4A353]"
                    style={{
                      borderColor: "var(--border-color)",
                      background: form.maintenance_mode
                        ? "#D4A353"
                        : "var(--bg-main)",
                    }}
                  />
                  <span
                    className={`absolute start-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.maintenance_mode ? "translate-x-5 rtl:-translate-x-5" : ""}`}
                  />
                </span>
              </label>
            </div>

            {updateMutation.isError && (
              <p
                role="alert"
                className="rounded-lg border px-4 py-3 text-sm text-red-500"
                style={{
                  borderColor: "rgba(239,68,68,.35)",
                  background: "rgba(239,68,68,.06)",
                }}
              >
                {t(
                  "تعذر حفظ الإعدادات. راجع البيانات وحاول مجدداً.",
                  "Settings could not be saved. Review the details and try again.",
                )}
              </p>
            )}

            <div
              className="flex flex-wrap items-center gap-4 border-t pt-5"
              style={{ borderColor: "var(--border-color)" }}
            >
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary min-h-11"
              >
                {updateMutation.isPending
                  ? t("جاري الحفظ...", "Saving...")
                  : t("حفظ الإعدادات", "Save Settings")}
              </button>
              <p
                aria-live="polite"
                className="flex items-center gap-1.5 text-sm font-semibold text-green-600"
              >
                {updateMutation.isSuccess && (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    {t("تم الحفظ بنجاح", "Saved successfully")}
                  </>
                )}
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

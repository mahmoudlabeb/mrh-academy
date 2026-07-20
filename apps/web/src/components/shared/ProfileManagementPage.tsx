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
  tutorProfile?: unknown | null;
};

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "At least 8 characters").regex(/(?=.*[A-Z])(?=.*\d)/, "Must contain at least one uppercase letter and one digit"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, { message: "Passwords do not match", path: ["confirmNewPassword"] });

type PasswordForm = z.infer<typeof passwordSchema>;

const emailSchema = z.object({ newEmail: z.string().email("Invalid email address") });
type EmailForm = z.infer<typeof emailSchema>;

type ProfileManagementPageProps = { title: string };

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export function ProfileManagementPage({ title }: ProfileManagementPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => { const { data } = await apiClient.get<UserProfile>("/users/me"); return data; },
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", timezone: "Africa/Cairo" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });

  useEffect(() => {
    if (!meQuery.data) return;
    profileForm.reset({
      firstName: meQuery.data.firstName ?? "",
      lastName: meQuery.data.lastName ?? "",
      phone: meQuery.data.phone ?? "",
      timezone: meQuery.data.timezone ?? "Africa/Cairo",
    });
    emailForm.reset({ newEmail: meQuery.data.email });
  }, [emailForm, meQuery.data, profileForm]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => { const { data } = await apiClient.patch<UserProfile>("/users/profile", values); return data; },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["me"] }); },
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => { const { data } = await apiClient.patch("/users/change-password", { currentPassword: values.currentPassword, newPassword: values.newPassword }); return data; },
    onSuccess: () => { passwordForm.reset({ currentPassword: "", newPassword: "", confirmNewPassword: "" }); },
  });

  const emailMutation = useMutation({
    mutationFn: async (values: EmailForm) => { const { data } = await apiClient.patch<UserProfile>("/users/change-email", values); return data; },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["me"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { const { data } = await apiClient.delete("/users/me"); return data; },
    onSuccess: async () => {
      await apiClient.post('/auth/logout').catch(() => undefined);
      router.push('/login');
    },
  });

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-500 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="card p-8 text-center max-w-sm">
          <p className="text-red-600 font-medium">{getErrorMessage(meQuery.error, "Failed to load profile")}</p>
        </div>
      </div>
    );
  }

  const user = meQuery.data;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || "MR";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-500 mt-1">Manage your account details</p>
          </div>
          <Link href={user.role === 'tutor' ? '/tutor' : '/student'} className="btn-secondary px-4 py-2 text-sm">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Section */}
        <div className="card p-8 animate-scale-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-6 border-b border-slate-100">
            <AvatarUploader
              currentAvatarUrl={user.avatarUrl ?? undefined}
              initials={initials}
              onSuccess={(avatarUrl) => {
                queryClient.setQueryData<UserProfile>(["me"], (current) => current ? { ...current, avatarUrl } : current);
              }}
            />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
              <p className="text-slate-500 text-sm">{user.email}</p>
              <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-100 mt-2 capitalize">{user.role}</span>
            </div>
          </div>

          <form onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))} className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" error={profileForm.formState.errors.firstName?.message}>
              <input {...profileForm.register("firstName")} className="input-field" />
            </Field>
            <Field label="Last name" error={profileForm.formState.errors.lastName?.message}>
              <input {...profileForm.register("lastName")} className="input-field" />
            </Field>
            <Field label="Phone" error={profileForm.formState.errors.phone?.message}>
              <input {...profileForm.register("phone")} className="input-field" placeholder="+1 (555) 000-0000" />
            </Field>
            <Field label="Timezone" error={profileForm.formState.errors.timezone?.message}>
              <input {...profileForm.register("timezone")} className="input-field" />
            </Field>

            <div className="sm:col-span-2">
              {profileMutation.error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-3">
                  <p className="text-sm text-red-600">{getErrorMessage(profileMutation.error, "Failed to update profile")}</p>
                </div>
              )}
              {profileMutation.isSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 mb-3">
                  <p className="text-sm text-emerald-600">Profile updated successfully</p>
                </div>
              )}
              <button type="submit" disabled={profileMutation.isPending} className="btn-primary">
                {profileMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Change Password</h2>
          <form onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))} className="flex flex-col gap-5">
            <Field label="Current password" error={passwordForm.formState.errors.currentPassword?.message}>
              <input {...passwordForm.register("currentPassword")} type="password" className="input-field" placeholder="Enter current password" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="New password" error={passwordForm.formState.errors.newPassword?.message}>
                <input {...passwordForm.register("newPassword")} type="password" className="input-field" placeholder="Min. 8 characters" />
              </Field>
              <Field label="Confirm new password" error={passwordForm.formState.errors.confirmNewPassword?.message}>
                <input {...passwordForm.register("confirmNewPassword")} type="password" className="input-field" placeholder="Repeat password" />
              </Field>
            </div>
            {passwordMutation.error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{getErrorMessage(passwordMutation.error, "Failed to update password")}</p>
              </div>
            )}
            {passwordMutation.isSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-sm text-emerald-600">Password updated successfully</p>
              </div>
            )}
            <button type="submit" disabled={passwordMutation.isPending} className="btn-primary w-fit">
              {passwordMutation.isPending ? "Updating..." : "Change password"}
            </button>
          </form>
        </div>

        {/* Change Email */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Change Email</h2>
          <form onSubmit={emailForm.handleSubmit((values) => emailMutation.mutate(values))} className="flex flex-col gap-5">
            <Field label="New email" error={emailForm.formState.errors.newEmail?.message}>
              <input {...emailForm.register("newEmail")} className="input-field" />
            </Field>
            {emailMutation.error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{getErrorMessage(emailMutation.error, "Failed to update email")}</p>
              </div>
            )}
            {emailMutation.isSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-sm text-emerald-600">Email updated successfully</p>
              </div>
            )}
            <button type="submit" disabled={emailMutation.isPending} className="btn-primary w-fit">
              {emailMutation.isPending ? "Updating..." : "Change email"}
            </button>
          </form>
        </div>

        {/* Delete Account */}
        <div className="card p-8 border-red-200">
          <h2 className="text-xl font-bold text-red-700 mb-2">Delete Account</h2>
          <p className="text-sm text-slate-500 mb-6">This cancels active lessons, refunds affected students, and permanently deletes your account.</p>
          <button type="button" onClick={() => setIsDeleteOpen(true)} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
            Delete account
          </button>
        </div>

        {/* Delete Modal */}
        {isDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in">
            <div className="w-full max-w-md card p-8 animate-scale-in">
              <h2 className="text-xl font-bold text-red-700 mb-2">Confirm account deletion</h2>
              <p className="text-sm text-slate-500 mb-4">Type <span className="font-semibold text-slate-900">DELETE</span> to permanently delete your account.</p>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="input-field"
                placeholder="DELETE"
              />
              {deleteMutation.error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mt-4">
                  <p className="text-sm text-red-600">{getErrorMessage(deleteMutation.error, "Failed to delete account")}</p>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsDeleteOpen(false); setDeleteConfirmation(""); }} className="btn-secondary px-5">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmation !== "DELETE" || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  className="btn-primary bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

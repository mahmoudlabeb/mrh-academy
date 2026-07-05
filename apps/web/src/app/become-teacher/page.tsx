"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

const applyTutorSchema = z.object({
  bio: z.string().trim().min(50, "Bio must be at least 50 characters."),
  specialization: z.string().trim().min(2, "Specialization is required."),
  languages: z
    .array(
      z.object({
        value: z.string().trim().min(1, "Language is required."),
      })
    )
    .min(1, "Add at least one language."),
  hourlyRate: z.number().min(5, "Hourly rate must be at least $5."),
  videoUrl: z
    .union([z.literal(""), z.string().trim().url("Enter a valid URL.")])
    .optional(),
});

type ApplyTutorFormValues = z.infer<typeof applyTutorSchema>;

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}

export default function BecomeTeacherPage() {
  const router = useRouter();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ApplyTutorFormValues>({
    resolver: zodResolver(applyTutorSchema),
    defaultValues: {
      bio: "",
      specialization: "",
      languages: [{ value: "" }],
      hourlyRate: 10,
      videoUrl: "",
    },
  });

  const { append, fields, remove } = useFieldArray({
    control,
    name: "languages",
  });

  const applyMutation = useMutation({
    mutationFn: async (values: ApplyTutorFormValues) => {
      const formData = new FormData();
      formData.append("bio", values.bio.trim());
      formData.append("specialization", values.specialization.trim());
      formData.append("hourlyRate", String(values.hourlyRate));
      if (values.videoUrl) formData.append("videoUrl", values.videoUrl.trim());
      values.languages.forEach((language, index) => {
        formData.append(`languages[${index}]`, language.value.trim());
      });
      if (documentFile) {
        formData.append("document", documentFile);
      }

      const { data } = await apiClient.post("/tutors/apply", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return data;
    },
    onSuccess: () => {
      router.push("/");
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error, "Failed to submit application"));
    },
  });

  const onSubmit = (values: ApplyTutorFormValues) => {
    setSubmitError("");
    applyMutation.mutate(values);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Apply to Be a Tutor</h1>
              <p className="text-slate-500 mt-1">Share your expertise with students worldwide</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">Home</Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="card p-8 animate-scale-in">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio</label>
              <textarea
                {...register("bio")}
                rows={4}
                className="input-field resize-none"
                placeholder="Tell us about your experience, qualifications, and teaching philosophy..."
              />
              {errors.bio && <p className="mt-1 text-xs text-red-500">{errors.bio.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Specialization</label>
              <input
                {...register("specialization")}
                className="input-field"
                placeholder="e.g. Mathematics, Physics, English Literature"
              />
              {errors.specialization && <p className="mt-1 text-xs text-red-500">{errors.specialization.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Languages</label>
                <button
                  type="button"
                  onClick={() => append({ value: "" })}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  + Add language
                </button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`languages.${index}.value`)}
                      className="input-field flex-1"
                      placeholder="e.g. English, Arabic"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {errors.languages && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.languages.message || errors.languages.root?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                min="5"
                {...register("hourlyRate", { valueAsNumber: true })}
                className="input-field max-w-xs"
              />
              {errors.hourlyRate && <p className="mt-1 text-xs text-red-500">{errors.hourlyRate.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Introduction Video URL (optional)</label>
              <input
                type="url"
                {...register("videoUrl")}
                className="input-field"
                placeholder="https://youtube.com/..."
              />
              {errors.videoUrl && <p className="mt-1 text-xs text-red-500">{errors.videoUrl.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Supporting Document (optional)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                  className="input-field file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}
            {applyMutation.isSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-sm text-emerald-600">Application submitted successfully!</p>
              </div>
            )}

            <button
              type="submit"
              disabled={applyMutation.isPending}
              className="btn-primary w-full py-3.5"
            >
              {applyMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting application...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Submit Application
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

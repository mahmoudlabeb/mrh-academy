"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { apiClient } from "@/lib/api-client";

type AvatarUploaderProps = {
  currentAvatarUrl?: string;
  onSuccess: (newUrl: string) => void;
  initials?: string;
};

export function AvatarUploader({
  currentAvatarUrl,
  onSuccess,
  initials = "MR",
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Only JPEG and PNG files are allowed");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar file must be 2MB or smaller");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await apiClient.post("/users/avatar", formData);
      setPreviewUrl(data.avatarUrl);
      onSuccess(data.avatarUrl);
    } catch (uploadError) {
      setError(
        (uploadError as { response?: { data?: { message?: string } } })
          ?.response?.data?.message || "Failed to upload avatar",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="group relative h-24 w-24 overflow-hidden rounded-full border bg-gray-100 text-sm font-semibold text-gray-500 disabled:opacity-60"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Profile avatar"
            fill
            sizes="96px"
            className="object-cover"
            unoptimized={!previewUrl.startsWith('http')}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg uppercase">
            {initials}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 z-10">
          {isUploading ? "Uploading..." : "Change"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

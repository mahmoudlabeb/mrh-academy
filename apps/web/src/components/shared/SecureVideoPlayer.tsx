"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";
import styles from "./SecureVideoPlayer.module.css";

export type SecureVideoStatus = {
  status:
    | "missing"
    | "created"
    | "uploaded"
    | "processing"
    | "ready"
    | "failed";
  embedUrl?: string;
  expiresAt?: number | string;
  durationSeconds?: number;
  captions?: Array<{ language: string; label: string }>;
};

type SecureVideoPlayerProps = {
  playbackEndpoint: string;
  title: string;
  enabled?: boolean;
  className?: string;
  missingMessage?: string;
  testId?: string;
};

function expiryMilliseconds(value: number | string | undefined) {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return value < 10_000_000_000 ? value * 1000 : value;
}

export function SecureVideoPlayer({
  playbackEndpoint,
  title,
  enabled = true,
  className,
  missingMessage,
  testId,
}: SecureVideoPlayerProps) {
  const { lang } = useLanguage();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const playbackQuery = useQuery({
    queryKey: ["secure-video-playback", playbackEndpoint],
    queryFn: async () =>
      (await apiClient.get<SecureVideoStatus>(playbackEndpoint)).data,
    enabled,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "created" ||
        status === "uploaded" ||
        status === "processing"
        ? 5_000
        : false;
    },
  });

  const expiresAt = expiryMilliseconds(playbackQuery.data?.expiresAt);
  const playbackStatus = playbackQuery.data?.status;
  const refetchPlayback = playbackQuery.refetch;
  useEffect(() => {
    if (!expiresAt || playbackStatus !== "ready") return;
    const delay = Math.max(1_000, expiresAt - Date.now() - 30_000);
    const timer = window.setTimeout(
      () => refetchPlayback(),
      Math.min(delay, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, playbackStatus, refetchPlayback]);

  const rootClassName = className
    ? `${styles.shell} ${className}`
    : styles.shell;

  if (!enabled || playbackQuery.isLoading) {
    return (
      <div
        className={rootClassName}
        aria-busy="true"
        aria-label={tr("جاري تحميل الفيديو الآمن", "Loading secure video")}
        data-testid={testId}
      >
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <strong>{tr("جاري تجهيز المشغّل الآمن", "Preparing secure player")}</strong>
          <p>{tr("لن يبدأ التشغيل قبل اكتمال الحماية.", "Playback starts only after the secure link is ready.")}</p>
        </div>
      </div>
    );
  }

  if (playbackQuery.isError || playbackQuery.data?.status === "failed") {
    return (
      <div className={rootClassName} role="alert" data-testid={testId}>
        <div className={styles.state}>
          <span className={styles.mark} aria-hidden="true">!</span>
          <strong>{tr("تعذّر تشغيل الفيديو", "Video could not be played")}</strong>
          <p>{tr("تحقق من اتصالك ثم اطلب رابط تشغيل آمنًا جديدًا.", "Check your connection, then request a fresh secure playback link.")}</p>
          <button
            className={styles.retry}
            type="button"
            onClick={() => playbackQuery.refetch()}
          >
            {tr("إعادة المحاولة", "Try again")}
          </button>
        </div>
      </div>
    );
  }

  const playback = playbackQuery.data;
  if (!playback || playback.status === "missing") {
    return (
      <div className={rootClassName} data-testid={testId}>
        <div className={styles.state}>
          <span className={styles.mark} aria-hidden="true">▶</span>
          <strong>
            {missingMessage ??
              tr("لا يوجد فيديو متاح حتى الآن", "No video is available yet")}
          </strong>
          <p>{tr("سيظهر الفيديو هنا بعد رفعه وتجهيزه.", "The video will appear here after it is uploaded and processed.")}</p>
        </div>
      </div>
    );
  }

  if (
    playback.status === "created" ||
    playback.status === "uploaded" ||
    playback.status === "processing"
  ) {
    return (
      <div className={rootClassName} aria-live="polite" data-testid={testId}>
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <strong>{tr("الفيديو قيد المعالجة", "Video is processing")}</strong>
          <p>{tr("نجهّز نسخ تشغيل مناسبة لكل الأجهزة. ستتحدث هذه الشاشة تلقائيًا.", "We are preparing playback for every device. This view refreshes automatically.")}</p>
        </div>
      </div>
    );
  }

  if (!playback.embedUrl) {
    return (
      <div className={rootClassName} role="alert" data-testid={testId}>
        <div className={styles.state}>
          <span className={styles.mark} aria-hidden="true">!</span>
          <strong>{tr("رابط التشغيل غير متاح", "Playback link is unavailable")}</strong>
          <button className={styles.retry} type="button" onClick={() => playbackQuery.refetch()}>
            {tr("تحديث الرابط", "Refresh link")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName} data-testid={testId}>
      <iframe
        className={styles.frame}
        src={playback.embedUrl}
        title={title}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        onError={() => playbackQuery.refetch()}
      />
      {Boolean(playback.captions?.length) && (
        <p className={styles.captionNotice} data-testid="video-captions-notice">
          <span aria-hidden="true">CC</span>
          {tr(
            `تتوفر ترجمة: ${playback.captions?.map((caption) => caption.label).join("، ")}`,
            `Captions available: ${playback.captions?.map((caption) => caption.label).join(", ")}`,
          )}
        </p>
      )}
    </div>
  );
}

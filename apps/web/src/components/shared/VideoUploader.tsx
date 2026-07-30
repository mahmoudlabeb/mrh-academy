"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";
import {
  SecureVideoPlayer,
  type SecureVideoStatus,
} from "./SecureVideoPlayer";
import styles from "./VideoUploader.module.css";

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

type VideoUploaderProps = {
  title: string;
  description: string;
  uploadEndpoint: string;
  statusEndpoint: string;
  deleteEndpoint: string;
  captionsEndpoint: string;
  captionDeleteEndpoint: (language: string) => string;
  uploadField?: string;
  enabled?: boolean;
  readonly?: boolean;
  onChange?: () => void;
  testId?: string;
};

function apiError(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function VideoUploader({
  title,
  description,
  uploadEndpoint,
  statusEndpoint,
  deleteEndpoint,
  captionsEndpoint,
  captionDeleteEndpoint,
  uploadField = "video",
  enabled = true,
  readonly = false,
  onChange,
  testId,
}: VideoUploaderProps) {
  const { lang } = useLanguage();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const inputId = useId();
  const captionsId = useId();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState<string>(lang);
  const [captionError, setCaptionError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["video-uploader-status", statusEndpoint],
    queryFn: async () =>
      (await apiClient.get<SecureVideoStatus>(statusEndpoint)).data,
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
  const hasExisting = Boolean(
    statusQuery.data && statusQuery.data.status !== "missing",
  );

  useEffect(() => {
    if (!selectedFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const refreshStatus = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["video-uploader-status", statusEndpoint],
    });
    await queryClient.invalidateQueries({
      queryKey: ["secure-video-playback", statusEndpoint],
    });
    onChange?.();
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append(uploadField, file);
      return (
        await apiClient.post<SecureVideoStatus>(uploadEndpoint, body, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (!event.total) return;
            setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          },
        })
      ).data;
    },
    onMutate: () => {
      setValidationError(null);
      setSuccessMessage(null);
      setProgress(0);
    },
    onSuccess: async () => {
      setProgress(100);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccessMessage(
        tr(
          "تم الرفع بأمان. تتم الآن معالجة الفيديو للتشغيل.",
          "Upload secured. The video is now processing for playback.",
        ),
      );
      await refreshStatus();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => (await apiClient.delete(deleteEndpoint)).data,
    onSuccess: async () => {
      setConfirmDelete(false);
      setSelectedFile(null);
      setSuccessMessage(tr("تم حذف الفيديو.", "Video deleted."));
      await refreshStatus();
    },
  });

  const captionMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("captions", file);
      body.append("language", captionLanguage);
      body.append(
        "label",
        captionLanguage === "ar" ? "العربية" : captionLanguage.toUpperCase(),
      );
      return (
        await apiClient.post(captionsEndpoint, body, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setCaptionError(null);
      if (captionInputRef.current) captionInputRef.current.value = "";
      setSuccessMessage(tr("تمت إضافة الترجمة.", "Captions added."));
      await refreshStatus();
    },
  });

  const deleteCaptionMutation = useMutation({
    mutationFn: async (language: string) =>
      (await apiClient.delete(captionDeleteEndpoint(language))).data,
    onSuccess: async () => {
      setSuccessMessage(tr("تم حذف ملف الترجمة.", "Caption track deleted."));
      await refreshStatus();
    },
  });

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setValidationError(null);
    setSuccessMessage(null);
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      setValidationError(
        tr(
          "اختر ملف MP4 أو WebM أو MOV صالحًا.",
          "Choose a valid MP4, WebM, or MOV file.",
        ),
      );
      event.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setValidationError(
        tr(
          "يجب ألا يتجاوز حجم الفيديو 250 ميجابايت.",
          "Video must be 250MB or smaller.",
        ),
      );
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    uploadMutation.mutate(file);
  }

  function selectCaption(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCaptionError(null);
    if (!file) return;
    const validType =
      file.type === "text/vtt" || file.name.toLowerCase().endsWith(".vtt");
    if (!validType) {
      setCaptionError(
        tr("اختر ملف ترجمة WebVTT بصيغة .vtt.", "Choose a WebVTT .vtt caption file."),
      );
      event.target.value = "";
      return;
    }
    if (file.size > MAX_CAPTION_BYTES) {
      setCaptionError(
        tr("يجب ألا يتجاوز ملف الترجمة 2 ميجابايت.", "Caption file must be 2MB or smaller."),
      );
      event.target.value = "";
      return;
    }
    captionMutation.mutate(file);
  }

  const uploadError = uploadMutation.isError
    ? apiError(
        uploadMutation.error,
        tr(
          "لم يكتمل الرفع. الملف ما زال محددًا ويمكنك المحاولة مجددًا.",
          "Upload did not finish. Your file is still selected and ready to retry.",
        ),
      )
    : null;
  const statusText = uploadMutation.isPending
    ? tr(`جاري الرفع ${progress}%`, `Uploading ${progress}%`)
    : statusQuery.data?.status === "ready"
      ? tr("جاهز للتشغيل الآمن", "Ready for secure playback")
      : statusQuery.data?.status === "created" ||
          statusQuery.data?.status === "uploaded" ||
          statusQuery.data?.status === "processing"
        ? tr("قيد المعالجة", "Processing")
        : hasExisting
          ? tr("تم حفظ الفيديو", "Video saved")
          : tr("لم يُرفع فيديو بعد", "No video uploaded yet");

  return (
    <section
      className={styles.studio}
      aria-labelledby={`${inputId}-title`}
      data-testid={testId}
    >
      <header className={styles.topline}>
        <div>
          <span className={styles.eyebrow}>
            {tr("استوديو الوسائط", "Media studio")}
          </span>
          <h3 id={`${inputId}-title`}>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={styles.secureBadge}>
          {tr("تشغيل محمي", "Secure playback")}
        </span>
      </header>

      <div className={styles.preview}>
        {localUrl ? (
          <>
            <video
              className={styles.localVideo}
              controls
              muted
              preload="metadata"
              src={localUrl}
              aria-label={tr("معاينة الفيديو المحدد", "Selected video preview")}
            />
            <p className={styles.localLabel}>
              {hasExisting
                ? tr(
                    "معاينة البديل · الفيديو الحالي محفوظ حتى نجاح الرفع",
                    "Replacement preview · current video stays saved until upload succeeds",
                  )
                : tr("معاينة محلية", "Local preview")}
            </p>
          </>
        ) : (
          <SecureVideoPlayer
            playbackEndpoint={statusEndpoint}
            title={tr(`معاينة آمنة: ${title}`, `Secure preview: ${title}`)}
          />
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.statusRow} aria-live="polite">
          <span className={styles.statusMark}>
            <strong>{statusText}</strong>
          </span>
          {uploadMutation.isPending && <span>{progress}%</span>}
        </div>

        {uploadMutation.isPending && (
          <div
            className={styles.progress}
            role="progressbar"
            aria-label={tr("تقدم رفع الفيديو", "Video upload progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        )}

        {selectedFile && (
          <div className={styles.fileRow}>
            <div className={styles.fileName}>
              <strong>{selectedFile.name}</strong>
              <small>
                {formatMegabytes(selectedFile.size)}
                {hasExisting
                  ? tr(" · سيبقى الفيديو الحالي آمنًا حتى نجاح الاستبدال", " · Current video stays safe until replacement succeeds")
                  : ""}
              </small>
            </div>
          </div>
        )}

        {(validationError || uploadError) && (
          <div className={styles.error} role="alert">
            {validationError || uploadError}
          </div>
        )}
        {deleteMutation.isError && (
          <div className={styles.error} role="alert">
            {apiError(
              deleteMutation.error,
              tr("تعذّر حذف الفيديو.", "Video could not be deleted."),
            )}
          </div>
        )}
        {successMessage && (
          <div className={styles.success} role="status">
            {successMessage}
          </div>
        )}

        <div className={styles.actions}>
          <label
            htmlFor={inputId}
            className={readonly || !enabled ? styles.button : styles.primaryButton}
            aria-disabled={readonly || !enabled || uploadMutation.isPending}
          >
            <span aria-hidden="true">↑</span>
            {hasExisting
              ? tr("اختيار فيديو بديل", "Choose replacement")
              : tr("اختيار فيديو", "Choose video")}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className={styles.nativeInput}
            type="file"
            accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
            disabled={readonly || !enabled || uploadMutation.isPending}
            onChange={selectVideo}
          />
          {uploadMutation.isError && selectedFile && (
            <button
              className={styles.primaryButton}
              type="button"
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate(selectedFile)}
            >
              {tr("إعادة الرفع", "Retry upload")}
            </button>
          )}
          {hasExisting && !confirmDelete && (
            <button
              className={styles.dangerButton}
              type="button"
              disabled={readonly || deleteMutation.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              {tr("حذف الفيديو", "Delete video")}
            </button>
          )}
        </div>
        <p className={styles.help}>
          {tr(
            "MP4 أو WebM أو MOV · الحد الأقصى 250 ميجابايت. لا تُعرض ملفات التخزين مباشرة للجمهور.",
            "MP4, WebM, or MOV · 250MB maximum. Storage files are never exposed directly to the public.",
          )}
        </p>

        {confirmDelete && (
          <div className={styles.confirmation} role="alert">
            <p>
              <strong>{tr("حذف نهائي؟", "Delete permanently?")}</strong>
              <br />
              {tr("لن يعود الفيديو متاحًا للطلاب.", "The video will no longer be available to students.")}
            </p>
            <div className={styles.actions}>
              <button
                className={styles.button}
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                {tr("إلغاء", "Cancel")}
              </button>
              <button
                className={styles.dangerButton}
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending
                  ? tr("جاري الحذف…", "Deleting…")
                  : tr("تأكيد الحذف", "Confirm delete")}
              </button>
            </div>
          </div>
        )}

        {hasExisting && (
          <section className={styles.captions} aria-labelledby={`${captionsId}-heading`}>
            <div>
              <h4 id={`${captionsId}-heading`}>
                {tr("الترجمة النصية", "Captions")}
              </h4>
              <p className={styles.help}>
                {tr("أضف ملف WebVTT لتحسين الوصول.", "Add a WebVTT file to improve accessibility.")}
              </p>
            </div>
            {statusQuery.data?.captions?.map((caption) => (
              <div className={styles.captionItem} key={caption.language}>
                <span>
                  <strong>{caption.label}</strong> · {caption.language.toUpperCase()}
                </span>
                <button
                  className={styles.linkButton}
                  type="button"
                  disabled={readonly || deleteCaptionMutation.isPending}
                  onClick={() => deleteCaptionMutation.mutate(caption.language)}
                >
                  {tr("حذف", "Delete")}
                </button>
              </div>
            ))}
            <div className={styles.captionForm}>
              <label>
                <span className={styles.nativeInput}>
                  {tr("لغة الترجمة", "Caption language")}
                </span>
                <select
                  aria-label={tr("لغة الترجمة", "Caption language")}
                  value={captionLanguage}
                  disabled={readonly || captionMutation.isPending}
                  onChange={(event) => setCaptionLanguage(event.target.value)}
                >
                  <option value="ar">العربية (AR)</option>
                  <option value="en">English (EN)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="es">Español (ES)</option>
                  <option value="de">Deutsch (DE)</option>
                </select>
              </label>
              <label
                className={styles.button}
                htmlFor={captionsId}
                aria-disabled={readonly || captionMutation.isPending}
              >
                {tr("اختيار ملف .vtt", "Choose .vtt file")}
              </label>
              <input
                ref={captionInputRef}
                id={captionsId}
                className={styles.nativeInput}
                type="file"
                accept=".vtt,text/vtt"
                disabled={readonly || captionMutation.isPending}
                onChange={selectCaption}
              />
            </div>
            {(captionError || captionMutation.isError || deleteCaptionMutation.isError) && (
              <div className={styles.error} role="alert">
                {captionError ||
                  apiError(
                    captionMutation.error || deleteCaptionMutation.error,
                    tr("تعذّر تحديث الترجمة.", "Captions could not be updated."),
                  )}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

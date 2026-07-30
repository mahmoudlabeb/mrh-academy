"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";
import { SecureVideoPlayer, type SecureVideoStatus } from "./SecureVideoPlayer";
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
  onChange?: () => void | Promise<void>;
  testId?: string;
};

function apiError(error: unknown, fallback: string) {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
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
  const captionInputId = useId();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState<string>(lang);
  const [captionError, setCaptionError] = useState("");

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

  async function refreshStatus() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["video-uploader-status", statusEndpoint],
      }),
      queryClient.invalidateQueries({
        queryKey: ["secure-video-playback", statusEndpoint],
      }),
    ]);
    await onChange?.();
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append(uploadField, file);
      return (
        await apiClient.post<SecureVideoStatus>(uploadEndpoint, body, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (!event.total) return;
            setProgress(
              Math.min(100, Math.round((event.loaded / event.total) * 100)),
            );
          },
        })
      ).data;
    },
    onMutate: () => {
      setValidationError("");
      setSuccessMessage("");
      setProgress(0);
    },
    onSuccess: async () => {
      setProgress(100);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccessMessage(
        tr(
          "تم رفع الفيديو بنجاح وهو قيد المعالجة الآمنة.",
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
      setCaptionError("");
      if (captionInputRef.current) captionInputRef.current.value = "";
      setSuccessMessage(tr("تمت إضافة الترجمة.", "Captions added."));
      await refreshStatus();
    },
  });

  const deleteCaptionMutation = useMutation({
    mutationFn: async (language: string) =>
      (await apiClient.delete(captionDeleteEndpoint(language))).data,
    onSuccess: async () => {
      setSuccessMessage(tr("تم حذف مسار الترجمة.", "Caption track deleted."));
      await refreshStatus();
    },
  });

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setValidationError("");
    setSuccessMessage("");
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
          "يجب ألا يزيد حجم الفيديو عن 250 ميجابايت.",
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
    setCaptionError("");
    if (!file) return;
    const validType =
      file.type === "text/vtt" || file.name.toLowerCase().endsWith(".vtt");
    if (!validType) {
      setCaptionError(
        tr(
          "اختر ملف ترجمة WebVTT بامتداد .vtt.",
          "Choose a WebVTT .vtt caption file.",
        ),
      );
      event.target.value = "";
      return;
    }
    if (file.size > MAX_CAPTION_BYTES) {
      setCaptionError(
        tr(
          "يجب ألا يزيد حجم الترجمة عن 2 ميجابايت.",
          "Caption file must be 2MB or smaller.",
        ),
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
          "لم يكتمل الرفع. تحقق من حجم الملف والاتصال وحاول مجددًا.",
          "Upload did not finish. Your file is still selected and ready to retry.",
        ),
      )
    : "";
  const statusText = uploadMutation.isPending
    ? tr(`جارٍ الرفع ${progress}%`, `Uploading ${progress}%`)
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
          {tr("تشغيل آمن", "Secure playback")}
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
                    "معاينة الاستبدال — يبقى الفيديو الحالي محفوظًا حتى نجاح الرفع",
                    "Replacement preview — current video stays saved until upload succeeds",
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
                  ? tr(
                      " — يبقى الفيديو الحالي آمنًا حتى نجاح الاستبدال",
                      " — Current video stays safe until replacement succeeds",
                    )
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
        {!readonly && (
          <div className={styles.actions}>
            <label
              className={hasExisting ? styles.button : styles.primaryButton}
              aria-disabled={!enabled || uploadMutation.isPending}
              htmlFor={inputId}
            >
              {hasExisting
                ? tr("استبدال الفيديو", "Replace video")
                : tr("رفع فيديو", "Upload video")}
            </label>
            <input
              ref={inputRef}
              className={styles.nativeInput}
              id={inputId}
              type="file"
              accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
              disabled={!enabled || uploadMutation.isPending}
              onChange={selectVideo}
            />
            {uploadMutation.isError && selectedFile && (
              <button
                type="button"
                className={styles.button}
                disabled={uploadMutation.isPending}
                onClick={() => uploadMutation.mutate(selectedFile)}
              >
                {tr("إعادة المحاولة", "Retry upload")}
              </button>
            )}
            {hasExisting && (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmDelete(true)}
              >
                {tr("حذف الفيديو", "Delete video")}
              </button>
            )}
          </div>
        )}
        <p className={styles.help}>
          {tr(
            "الصيغ المدعومة: MP4 وWebM وMOV حتى 250 ميجابايت.",
            "Supported: MP4, WebM, and MOV up to 250MB.",
          )}
        </p>

        {confirmDelete && (
          <div className={styles.confirmation}>
            <p>
              <strong>{tr("حذف نهائي؟", "Delete permanently?")}</strong>
              <br />
              {tr(
                "لا يمكن التراجع عن عملية حذف الفيديو بعد تأكيدها.",
                "Viewers will no longer be able to play this video.",
              )}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setConfirmDelete(false)}
              >
                {tr("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending
                  ? tr("جارٍ الحذف…", "Deleting…")
                  : tr("تأكيد الحذف", "Confirm delete")}
              </button>
            </div>
          </div>
        )}

        {hasExisting && (
          <section
            className={styles.captions}
            data-testid="video-captions-notice"
          >
            <h4>{tr("الترجمة", "Captions")}</h4>
            {statusQuery.data?.captions?.map((caption) => (
              <div className={styles.captionItem} key={caption.language}>
                <span>{caption.label}</span>
                {!readonly && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={deleteCaptionMutation.isPending}
                    onClick={() =>
                      deleteCaptionMutation.mutate(caption.language)
                    }
                  >
                    {tr("حذف", "Remove")}
                  </button>
                )}
              </div>
            ))}
            {!readonly && (
              <div className={styles.captionForm}>
                <select
                  value={captionLanguage}
                  onChange={(event) => setCaptionLanguage(event.target.value)}
                  aria-label={tr("لغة الترجمة", "Caption language")}
                >
                  <option value="ar">{tr("العربية", "Arabic")}</option>
                  <option value="en">{tr("الإنجليزية", "English")}</option>
                  <option value="fr">{tr("الفرنسية", "French")}</option>
                </select>
                <label className={styles.button} htmlFor={captionInputId}>
                  {captionMutation.isPending
                    ? tr("جارٍ الرفع…", "Uploading…")
                    : tr("إضافة ملف VTT", "Add VTT file")}
                </label>
                <input
                  ref={captionInputRef}
                  className={styles.nativeInput}
                  id={captionInputId}
                  type="file"
                  accept=".vtt,text/vtt"
                  disabled={captionMutation.isPending}
                  onChange={selectCaption}
                />
              </div>
            )}
            {(captionError ||
              captionMutation.isError ||
              deleteCaptionMutation.isError) && (
              <div className={styles.error} role="alert">
                {captionError ||
                  apiError(
                    captionMutation.error || deleteCaptionMutation.error,
                    tr(
                      "تعذّر تحديث مسارات الترجمة.",
                      "Captions could not be updated.",
                    ),
                  )}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

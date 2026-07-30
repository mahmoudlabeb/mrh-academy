"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { ClassroomIcon } from "@/components/classroom/ClassroomIcon";

type DeviceState = "idle" | "requesting" | "ready" | "blocked";
type PracticeMode = "welcome" | "board" | "screen";
type PracticePanel = "chat" | "more" | "tools" | null;

export function PracticeClassroom() {
  const { lang, dir } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const drawingRef = useRef(false);
  const [deviceState, setDeviceState] = useState<DeviceState>("idle");
  const [mode, setMode] = useState<PracticeMode>("welcome");
  const [panel, setPanel] = useState<PracticePanel>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(
    () => () => {
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (sharing && screenRef.current && screenStreamRef.current) {
      screenRef.current.srcObject = screenStreamRef.current;
    }
  }, [mode, sharing]);

  async function prepareDevices() {
    setDeviceState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 1280, height: 720 },
      });
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = micOn;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = cameraOn;
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setDeviceState("ready");
    } catch {
      setDeviceState("blocked");
    }
  }

  function toggleMic() {
    const next = !micOn;
    mediaRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  }

  function toggleCamera() {
    const next = !cameraOn;
    mediaRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOn(next);
  }

  async function toggleScreen() {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      if (screenRef.current) screenRef.current.srcObject = null;
      setSharing(false);
      setMode("welcome");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      if (screenRef.current) screenRef.current.srcObject = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        screenStreamRef.current = null;
        setSharing(false);
        setMode("welcome");
      });
      setSharing(true);
      setMode("screen");
      setPanel(null);
    } catch {
      setSharing(false);
    }
  }

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    const context = event.currentTarget.getContext("2d");
    context?.beginPath();
    context?.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = pointerPosition(event);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    context.strokeStyle = "#f2b84b";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearBoard() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  const controls = [
    {
      id: "mic",
      label: micOn ? t("الميكروفون", "Mic") : t("تشغيل الصوت", "Unmute"),
      icon: micOn ? ("mic" as const) : ("micOff" as const),
      active: micOn,
      onClick: toggleMic,
    },
    {
      id: "camera",
      label: cameraOn
        ? t("الكاميرا", "Camera")
        : t("تشغيل الكاميرا", "Camera on"),
      icon: cameraOn ? ("camera" as const) : ("cameraOff" as const),
      active: cameraOn,
      onClick: toggleCamera,
    },
    {
      id: "canvas",
      label: t("السبورة", "Canvas"),
      icon: "board" as const,
      active: mode === "board",
      onClick: () => {
        setMode((current) => (current === "board" ? "welcome" : "board"));
        setPanel(null);
      },
    },
    {
      id: "tools",
      label: t("الأدوات", "Tools"),
      icon: "tools" as const,
      active: panel === "tools",
      onClick: () =>
        setPanel((current) => (current === "tools" ? null : "tools")),
    },
    {
      id: "share",
      label: sharing ? t("إيقاف", "Stop") : t("مشاركة", "Share"),
      icon: "screen" as const,
      active: sharing,
      onClick: () => void toggleScreen(),
    },
    {
      id: "chat",
      label: t("الدردشة", "Chat"),
      icon: "chat" as const,
      active: panel === "chat",
      onClick: () =>
        setPanel((current) => (current === "chat" ? null : "chat")),
    },
    {
      id: "more",
      label: t("المزيد", "More"),
      icon: "more" as const,
      active: panel === "more",
      onClick: () =>
        setPanel((current) => (current === "more" ? null : "more")),
    },
  ];

  return (
    <main
      className="practice-room classroom-shell"
      data-testid="classroom-shell"
      dir={dir}
    >
      <header className="practice-room__header classroom-topbar">
        <div className="classroom-room-id">
          <span className="classroom-room-id__icon">
            <ClassroomIcon name="user" />
          </span>
          <div>
            <h1>{t("فصل التدريب", "Training classroom")}</h1>
            <p>{t("مساحة تدريب خاصة", "Private practice space")}</p>
          </div>
        </div>
        <div className="classroom-top-actions">
          <span className="classroom-status-chip">
            <span className="classroom-status-dot is-ready" />
            {deviceState === "ready"
              ? t("الأجهزة جاهزة", "Devices ready")
              : t("وضع الاختبار", "Test mode")}
          </span>
          <button
            type="button"
            className="classroom-icon-button"
            aria-label={t("معلومات الفصل", "Classroom information")}
            onClick={() =>
              setPanel((current) => (current === "more" ? null : "more"))
            }
          >
            <ClassroomIcon name="info" />
          </button>
          <button
            type="button"
            className="classroom-icon-button"
            aria-label={t("حالة الاتصال", "Connection status")}
          >
            <ClassroomIcon name="signal" />
          </button>
        </div>
      </header>

      <section
        className="practice-room__stage"
        data-testid="classroom-stage"
        aria-label={t("منطقة التدريب", "Practice area")}
      >
        {mode === "board" && (
          <div className="practice-room__board">
            <header>
              <div>
                <strong>{t("سبورة التدريب", "Practice whiteboard")}</strong>
                <small>
                  {t("اختبر القلم أو اللمس", "Test mouse, pen, or touch input")}
                </small>
              </div>
              <button type="button" onClick={clearBoard}>
                {t("مسح السبورة", "Clear board")}
              </button>
            </header>
            <canvas
              ref={canvasRef}
              width={1600}
              height={900}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            />
          </div>
        )}

        {mode === "screen" && (
          <video
            ref={screenRef}
            autoPlay
            playsInline
            muted
            className="practice-room__shared-screen"
            aria-label={t("معاينة الشاشة المشتركة", "Shared screen preview")}
          />
        )}

        {mode === "welcome" && (
          <div className="classroom-stage-empty" role="status">
            <div className="classroom-stage-empty__icon">
              <ClassroomIcon name="user" />
            </div>
            <h2>{t("اختبر الفصل", "Test the classroom")}</h2>
            <p>
              {t(
                "عاين الصوت والصورة أو جرّب أدوات التدريس قبل موعد درسك.",
                "Preview your video and audio, or explore your teaching tools.",
              )}
            </p>
            {deviceState === "idle" && (
              <button
                type="button"
                className="classroom-stage-action"
                onClick={() => void prepareDevices()}
              >
                <ClassroomIcon name="camera" />
                {t("بدء فحص الأجهزة", "Start device check")}
              </button>
            )}
            {deviceState === "requesting" && (
              <span className="classroom-loading-line">
                <span />
                {t("جارٍ فتح الأجهزة…", "Opening your devices…")}
              </span>
            )}
          </div>
        )}

        <aside
          className={`practice-room__media ${cameraOn && deviceState === "ready" ? "has-video" : ""}`}
        >
          <video ref={videoRef} autoPlay playsInline muted />
          {(!cameraOn || deviceState !== "ready") && (
            <div className="classroom-video-placeholder">
              <ClassroomIcon
                name={deviceState === "blocked" ? "cameraOff" : "user"}
              />
              <span>
                {deviceState === "blocked"
                  ? t("تعذّر الوصول للكاميرا", "Camera unavailable")
                  : t("معاينة الكاميرا", "Camera preview")}
              </span>
            </div>
          )}
          <span className="classroom-video-label">
            {t("أنت", "You")}
            {!micOn && <ClassroomIcon name="micOff" />}
          </span>
        </aside>

        {deviceState === "blocked" && (
          <div className="classroom-stage-alert" role="alert">
            <ClassroomIcon name="cameraOff" />
            <span>
              {t(
                "اسمح للمتصفح باستخدام الكاميرا والميكروفون، ثم أعد المحاولة.",
                "Allow camera and microphone access in the browser, then try again.",
              )}
            </span>
            <button type="button" onClick={() => void prepareDevices()}>
              <ClassroomIcon name="retry" />
              {t("إعادة المحاولة", "Retry")}
            </button>
          </div>
        )}

        {panel && (
          <aside
            className="classroom-popover"
            aria-label={t("لوحة الفصل", "Classroom panel")}
          >
            <button
              type="button"
              className="classroom-popover__close"
              onClick={() => setPanel(null)}
              aria-label={t("إغلاق اللوحة", "Close panel")}
            >
              <ClassroomIcon name="close" />
            </button>
            {panel === "tools" && (
              <>
                <h2>{t("أدوات التدريب", "Practice tools")}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setMode("board");
                    setPanel(null);
                  }}
                >
                  <ClassroomIcon name="board" />
                  <span>
                    <strong>{t("فتح السبورة", "Open whiteboard")}</strong>
                    <small>
                      {t(
                        "اختبر الرسم بالقلم واللمس",
                        "Test pen and touch drawing",
                      )}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={clearBoard}>
                  <ClassroomIcon name="retry" />
                  <span>
                    <strong>{t("مسح السبورة", "Clear whiteboard")}</strong>
                    <small>
                      {t("ابدأ بصفحة نظيفة", "Start with a clean page")}
                    </small>
                  </span>
                </button>
              </>
            )}
            {panel === "chat" && (
              <>
                <h2>{t("الدردشة", "Chat")}</h2>
                <div className="classroom-panel-empty">
                  <ClassroomIcon name="chat" />
                  <p>
                    {t(
                      "هذه مساحة تدريب خاصة. تصبح الدردشة متاحة داخل الدرس المباشر.",
                      "This is a private practice space. Chat is available in a live lesson.",
                    )}
                  </p>
                </div>
              </>
            )}
            {panel === "more" && (
              <>
                <h2>{t("تفاصيل الاختبار", "Test details")}</h2>
                <div className="classroom-detail-list">
                  <span>
                    <ClassroomIcon name="mic" />
                    {t("الميكروفون", "Microphone")}
                    <b>{micOn ? t("يعمل", "On") : t("متوقف", "Off")}</b>
                  </span>
                  <span>
                    <ClassroomIcon name="camera" />
                    {t("الكاميرا", "Camera")}
                    <b>{cameraOn ? t("تعمل", "On") : t("متوقفة", "Off")}</b>
                  </span>
                  <span>
                    <ClassroomIcon name="screen" />
                    {t("مشاركة الشاشة", "Screen share")}
                    <b>{sharing ? t("تعمل", "On") : t("جاهزة", "Ready")}</b>
                  </span>
                </div>
                <button type="button" onClick={() => setPanel("tools")}>
                  <ClassroomIcon name="tools" />
                  <span>
                    <strong>{t("أدوات السبورة", "Whiteboard tools")}</strong>
                    <small>
                      {t(
                        "افتح أدوات الرسم والمسح",
                        "Open drawing and clearing tools",
                      )}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={() => void toggleScreen()}>
                  <ClassroomIcon name="screen" />
                  <span>
                    <strong>
                      {sharing
                        ? t("إيقاف مشاركة الشاشة", "Stop screen sharing")
                        : t("اختبار مشاركة الشاشة", "Test screen sharing")}
                    </strong>
                    <small>
                      {t(
                        "تحقق من إمكانية مشاركة نافذة أو شاشة",
                        "Verify that a window or screen can be shared",
                      )}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={() => void prepareDevices()}>
                  <ClassroomIcon name="retry" />
                  <span>
                    <strong>{t("إعادة فحص الأجهزة", "Retest devices")}</strong>
                    <small>
                      {t(
                        "افتح الكاميرا والميكروفون من جديد",
                        "Open camera and microphone again",
                      )}
                    </small>
                  </span>
                </button>
              </>
            )}
          </aside>
        )}
      </section>

      <footer className="classroom-dock" data-testid="classroom-dock">
        <div className="classroom-dock__controls">
          {controls.map((control) => (
            <button
              key={control.id}
              type="button"
              data-dock-action={control.id}
              className={control.active ? "is-active" : ""}
              aria-pressed={control.active}
              aria-label={control.label}
              onClick={control.onClick}
              disabled={
                deviceState === "requesting" &&
                (control.id === "mic" || control.id === "camera")
              }
            >
              <span>
                <ClassroomIcon name={control.icon} />
              </span>
              <small>{control.label}</small>
            </button>
          ))}
          <Link
            href={`/${lang}/learn/lessons`}
            className="classroom-dock__leave"
            data-dock-action="leave"
            aria-label={t("مغادرة فصل التدريب", "Leave training classroom")}
          >
            <span>
              <ClassroomIcon name="leave" />
            </span>
            <small>{t("مغادرة", "Leave")}</small>
          </Link>
        </div>
      </footer>
    </main>
  );
}

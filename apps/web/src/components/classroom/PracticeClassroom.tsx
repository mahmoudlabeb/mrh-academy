"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/language-context";

type DeviceState = "idle" | "requesting" | "ready" | "blocked";

export function PracticeClassroom() {
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const drawingRef = useRef(false);
  const [deviceState, setDeviceState] = useState<DeviceState>("idle");
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

  async function prepareDevices() {
    setDeviceState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 1280, height: 720 },
      });
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRef.current = stream;
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
      });
      setSharing(true);
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
    context.strokeStyle = "#6d4aff";
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

  return (
    <main className="practice-room">
      <header className="practice-room__header">
        <div>
          <p className="blueprint-kicker">
            {t("تجربة آمنة قبل الدرس", "Private pre-class check")}
          </p>
          <h1>{t("فصل التدريب", "Practice Classroom")}</h1>
          <p>
            {t(
              "اختبر الكاميرا والميكروفون ومشاركة الشاشة والسبورة. لا ينضم أي معلّم إلى هذه المساحة.",
              "Test your camera, microphone, screen sharing, and whiteboard. No tutor joins this private space.",
            )}
          </p>
        </div>
        <Link className="btn-secondary" href={`/${lang}/learn/lessons`}>
          {t("العودة إلى دروسي", "Back to my lessons")}
        </Link>
      </header>

      <section className="practice-room__stage">
        <div className="practice-room__media">
          <article>
            <video ref={videoRef} autoPlay playsInline muted />
            <span>{t("معاينة الكاميرا", "Camera preview")}</span>
          </article>
          <article className={sharing ? "" : "is-empty"}>
            <video ref={screenRef} autoPlay playsInline muted />
            <span>
              {sharing
                ? t("الشاشة التي تشاركها", "Your shared screen")
                : t("لم تبدأ مشاركة الشاشة", "Screen sharing is not active")}
            </span>
          </article>
        </div>

        <div className="practice-room__toolbar">
          <button
            type="button"
            className="btn-primary"
            disabled={deviceState === "requesting"}
            onClick={prepareDevices}
          >
            {deviceState === "requesting"
              ? t("جارٍ فحص الأجهزة…", "Checking devices…")
              : deviceState === "ready"
                ? t("إعادة فحص الأجهزة", "Retest devices")
                : t("فحص الكاميرا والميكروفون", "Test camera & microphone")}
          </button>
          <button type="button" className="btn-secondary" onClick={toggleMic}>
            {micOn
              ? t("كتم الميكروفون", "Mute microphone")
              : t("تشغيل الميكروفون", "Turn microphone on")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={toggleCamera}
          >
            {cameraOn
              ? t("إيقاف الكاميرا", "Turn camera off")
              : t("تشغيل الكاميرا", "Turn camera on")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={toggleScreen}
          >
            {sharing
              ? t("إيقاف المشاركة", "Stop sharing")
              : t("اختبار مشاركة الشاشة", "Test screen sharing")}
          </button>
        </div>

        {deviceState === "blocked" && (
          <p className="blueprint-error" role="alert">
            {t(
              "تعذّر الوصول إلى أجهزتك. اسمح للمتصفح باستخدام الكاميرا والميكروفون ثم أعد المحاولة.",
              "Your devices could not be opened. Allow camera and microphone access in the browser, then try again.",
            )}
          </p>
        )}

        <div className="practice-room__board">
          <header>
            <div>
              <strong>{t("سبورة التدريب", "Practice whiteboard")}</strong>
              <small>
                {t(
                  "ارسم للتأكد من عمل القلم أو اللمس.",
                  "Draw to verify mouse, pen, or touch input.",
                )}
              </small>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={clearBoard}
            >
              {t("مسح السبورة", "Clear board")}
            </button>
          </header>
          <canvas
            ref={canvasRef}
            width={1600}
            height={700}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
        </div>
      </section>
    </main>
  );
}

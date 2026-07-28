"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { SecureBookViewer } from "@/components/classroom/SecureBookViewer";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";
import {
  ClassroomBookPanel,
  type LessonBookMeta,
} from "@/components/classroom/ClassroomBookPanel";

interface ChatMessage {
  senderId: string;
  content: string;
  timestamp: string;
}

interface DrawAction {
  type: "stroke" | "erase";
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface Participant {
  userId: string;
  role: string;
}

interface WhiteboardState {
  pages: Record<string, DrawAction[]>;
  currentPage: number;
}

interface BookSessionState {
  active: boolean;
  bookId: string;
  title: string;
  pageCount: number;
  page: number;
}

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "var(--signal)"];
const ERASER_WIDTH = 30;

export const dynamic = "force-dynamic";

export default function ClassroomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { lang, dir } = useLanguage();
  const isRtl = dir === "rtl";

  const t = (ar: string, en: string) => (dir === "rtl" ? ar : en);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<{ points: { x: number; y: number }[] }>({
    points: [],
  });

  const [toolColor, setToolColor] = useState("#000000");
  const [toolWidth, setToolWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [pages, setPages] = useState<Record<string, DrawAction[]>>({ "1": [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sideTab, setSideTab] = useState<"chat" | "participants">("chat");
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [focusedStudent, setFocusedStudent] = useState<string | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, number>>({});
  const [mainView, setMainView] = useState<"whiteboard" | "book">("whiteboard");
  const [bookSession, setBookSession] = useState<BookSessionState | null>(null);
  const [joined, setJoined] = useState(false);
  const [preflightStream, setPreflightStream] = useState<MediaStream | null>(
    null,
  );
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenTested, setScreenTested] = useState(false);
  const preflightVideoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rttPingRef = useRef<number | null>(null);

  const {
    data: lesson,
    isError: lessonError,
    isLoading: lessonLoading,
  } = useQuery({
    queryKey: ["lesson-by-room", roomId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lessons/by-room/${roomId}`);
      return data as {
        id: string;
        status: string;
        title?: string;
        googleMeetUrl?: string;
        tutor?: { firstName?: string };
        student?: { firstName?: string };
      };
    },
    enabled: !!roomId && !!user,
    retry: false,
  });

  const lessonId = lesson?.id;
  const peerUser = participants.find((p) => p.userId !== user?.id);
  const {
    activeCall,
    remoteStreams,
    localStreamRef,
    isCallLoading,
    callError,
    connectionStatus,
    startCall,
    stopCall,
  } = useWebRTC(lessonId ?? "", user?.id || "", peerUser?.userId || null);

  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dialogOpen = showLeaveConfirm || showReport;
    if (!dialogOpen) return;
    dialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialogRef.current?.focus());
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLeaveConfirm(false);
        setShowReport(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!controls.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      requestAnimationFrame(() => dialogReturnFocusRef.current?.focus());
    };
  }, [showLeaveConfirm, showReport]);

  useEffect(() => {
    // Never request device access until the authenticated user has passed the
    // server-backed room membership check.
    if (joined || !user || !lessonId) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true, video: { width: 960, height: 540 } })
      .then((nextStream) => {
        stream = nextStream;
        setPreflightStream(nextStream);
        if (preflightVideoRef.current)
          preflightVideoRef.current.srcObject = nextStream;
      })
      .catch((error: unknown) => {
        setPreflightError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? t(
                "تم رفض إذن الكاميرا أو الميكروفون. يمكنك المتابعة وتفعيلهما لاحقًا من إعدادات المتصفح.",
                "Camera or microphone permission was denied. You can continue and enable them later in browser settings.",
              )
            : t(
                "تعذّر فحص الكاميرا والميكروفون. تأكد من استخدام HTTPS ومن توصيل أجهزتك.",
                "We could not test your camera and microphone. Check HTTPS and your connected devices.",
              ),
        );
      });
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
    // `t` is intentionally locale-derived and the preflight should only restart
    // when the room/join state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, joined, user, lessonId]);

  useEffect(() => {
    preflightStream?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled, preflightStream]);

  useEffect(() => {
    preflightStream?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled, preflightStream]);

  useEffect(() => {
    if (connectionStatus === "failed") {
      fallbackTimerRef.current = setTimeout(
        () => setShowFallback(true),
        15_000,
      );
    } else {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      setShowFallback(false);
    }
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [connectionStatus]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
    }
  }, []);

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, action: DrawAction) => {
      if (action.points.length < 2) return;
      ctx.beginPath();
      if (action.type === "erase") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = action.width;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.width;
      }
      ctx.moveTo(action.points[0].x, action.points[0].y);
      for (let i = 1; i < action.points.length; i++) {
        ctx.lineTo(action.points[i].x, action.points[i].y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    },
    [],
  );

  const redrawPage = useCallback(
    (pageNum: number) => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
      const pageActions = pages[String(pageNum)] || [];
      for (const action of pageActions) {
        drawStroke(ctx, action);
      }
    },
    [pages, drawStroke],
  );

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

  useEffect(() => {
    if (canvasRef.current && ctxRef.current) {
      redrawPage(currentPage);
    }
  }, [currentPage, pages, redrawPage]);

  useEffect(() => {
    if (!joined || !user || !roomId || !lessonId) return;
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("join_lesson", { lessonId });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onWhiteboardSync = (state: WhiteboardState) => {
      setPages(state.pages || { "1": [] });
      setCurrentPage(state.currentPage || 1);
    };

    const onCanvasUpdate = (payload: {
      userId: string;
      page: number;
      data: DrawAction;
    }) => {
      const { page, data } = payload;
      setPages((prev) => {
        const key = String(page);
        const existing = prev[key] || [];
        if (existing.some((a) => a === data)) return prev;
        return { ...prev, [key]: [...existing, data] };
      });
    };

    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onPageChange = (payload: { page: number }) => {
      setCurrentPage(payload.page);
    };

    const onBookSync = (state: BookSessionState) => {
      if (state?.active && state.bookId) {
        setBookSession(state);
        setMainView("book");
      }
    };

    const onBookPageChange = (payload: { page: number }) => {
      setBookSession((prev) => (prev ? { ...prev, page: payload.page } : prev));
    };

    const onBookClose = () => {
      setBookSession(null);
      setMainView("whiteboard");
    };

    const onPeerJoined = (p: Participant) => {
      setParticipants((prev) => {
        if (prev.some((x) => x.userId === p.userId)) return prev;
        return [...prev, p];
      });
    };

    const onPeerLeft = (p: { userId: string }) => {
      setParticipants((prev) => prev.filter((x) => x.userId !== p.userId));
    };

    const onPongHealth = (payload: {
      timestamp: number;
      serverTime: number;
    }) => {
      const now = Date.now();
      const measuredRtt = now - payload.timestamp;
      setRtt(measuredRtt);
      if (rttPingRef.current) {
        clearTimeout(rttPingRef.current);
      }
      rttPingRef.current = window.setTimeout(() => {
        socket.emit("health_report", { lessonId, rtt: measuredRtt });
      }, 100);
    };

    const onConnectionHealth = (payload: {
      participants: { userId: string; rtt: number }[];
    }) => {
      const map: Record<string, number> = {};
      for (const p of payload.participants) {
        map[p.userId] = p.rtt;
      }
      setHealthMap(map);
    };

    let healthInterval: ReturnType<typeof setInterval> | null = null;

    if (socket.connected) {
      onConnect();
    } else {
      socket.on("connect", onConnect);
    }
    socket.on("disconnect", onDisconnect);
    socket.on("whiteboard_sync", onWhiteboardSync);
    socket.on("canvas_update", onCanvasUpdate);
    socket.on("chat_message", onChatMessage);
    socket.on("whiteboard_page_change", onPageChange);
    socket.on("book_sync", onBookSync);
    socket.on("book_page_change", onBookPageChange);
    socket.on("book_close", onBookClose);
    socket.on("peer_joined", onPeerJoined);
    socket.on("peer_left", onPeerLeft);
    socket.on("pong_health", onPongHealth);
    socket.on("connection_health", onConnectionHealth);

    healthInterval = setInterval(() => {
      socket.emit("ping_health", { timestamp: Date.now() });
    }, 5000);

    return () => {
      if (healthInterval) clearInterval(healthInterval);
      if (rttPingRef.current) clearTimeout(rttPingRef.current);
      socket.emit("leave_lesson", { lessonId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("whiteboard_sync", onWhiteboardSync);
      socket.off("canvas_update", onCanvasUpdate);
      socket.off("chat_message", onChatMessage);
      socket.off("whiteboard_page_change", onPageChange);
      socket.off("book_sync", onBookSync);
      socket.off("book_page_change", onBookPageChange);
      socket.off("book_close", onBookClose);
      socket.off("peer_joined", onPeerJoined);
      socket.off("peer_left", onPeerLeft);
      socket.off("pong_health", onPongHealth);
      socket.off("connection_health", onConnectionHealth);
    };
  }, [joined, user, lessonId, roomId]);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // Classroom content is private course material. These browser-level
  // deterrents reduce casual copying while the server/session checks remain
  // the actual access control. No web app can block OS-level screenshots.
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const preventCopy = (event: ClipboardEvent) => event.preventDefault();
    const preventCaptureShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        key === "printscreen" ||
        (event.ctrlKey && ["p", "s", "u", "c"].includes(key)) ||
        (event.metaKey && ["p", "s", "c"].includes(key))
      ) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("keydown", preventCaptureShortcuts);
    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("copy", preventCopy);
      document.removeEventListener("keydown", preventCaptureShortcuts);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getPointerPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const pos = getPointerPos(e);
    currentStroke.current = { points: [pos] };

    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = ERASER_WIDTH;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = toolColor;
      ctx.lineWidth = toolWidth;
    }
    ctx.moveTo(pos.x, pos.y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const pos = getPointerPos(e);
    currentStroke.current.points.push(pos);

    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const points = currentStroke.current.points;
    if (points.length < 2) return;

    const action: DrawAction = {
      type: isEraser ? "erase" : "stroke",
      points: [...points],
      color: isEraser ? "" : toolColor,
      width: isEraser ? ERASER_WIDTH : toolWidth,
    };

    const pageStr = String(currentPage);
    setPages((prev) => ({
      ...prev,
      [pageStr]: [...(prev[pageStr] || []), action],
    }));

    const socket = getSocket();
    socket.emit("canvas_draw", { lessonId, page: currentPage, data: action });
  };

  const handleUndo = () => {
    const pageStr = String(currentPage);
    setPages((prev) => {
      const actions = prev[pageStr] || [];
      if (actions.length === 0) return prev;
      return { ...prev, [pageStr]: actions.slice(0, -1) };
    });
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
      redrawPage(currentPage);
    }
  };

  const handleClear = () => {
    const pageStr = String(currentPage);
    setPages((prev) => ({ ...prev, [pageStr]: [] }));
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
    }
  };

  const changePage = (delta: number) => {
    const newPage = Math.max(1, currentPage + delta);
    setCurrentPage(newPage);
    const socket = getSocket();
    socket.emit("whiteboard_page_change", { lessonId, page: newPage });
  };

  const changeBookPage = (delta: number) => {
    if (!bookSession || !lessonId) return;
    const newPage = Math.max(
      1,
      Math.min(bookSession.pageCount, bookSession.page + delta),
    );
    setBookSession((prev) => (prev ? { ...prev, page: newPage } : prev));
    if (user?.role === "tutor") {
      const socket = getSocket();
      socket.emit("book_page_change", { lessonId, page: newPage });
    }
  };

  const presentBook = (book: LessonBookMeta) => {
    if (!lessonId) return;
    const socket = getSocket();
    const payload = {
      lessonId,
      bookId: book.id,
      title: book.title,
      pageCount: book.pageCount,
      page: 1,
    };
    socket.emit("book_present", payload);
    setBookSession({
      active: true,
      bookId: book.id,
      title: book.title,
      pageCount: book.pageCount,
      page: 1,
    });
    setMainView("book");
  };

  const closeBookPresentation = () => {
    if (!lessonId) return;
    const socket = getSocket();
    socket.emit("book_close", { lessonId });
    setBookSession(null);
    setMainView("whiteboard");
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("send_chat", { lessonId, content: chatInput.trim() });
    setChatInput("");
  };

  const handleLeave = () => {
    const socket = getSocket();
    socket.emit("leave_lesson", { lessonId });
    disconnectSocket();
    const redirectPath = user?.role === "tutor" ? "/tutor" : "/student";
    router.push(redirectPath);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleReportSubmit = async () => {
    if (!reportSubject.trim()) return;
    try {
      await apiClient.post("/reports", {
        lessonId,
        issueType: reportSubject,
        description: reportDescription,
      });
      setShowReport(false);
      setReportSubject("");
      setReportDescription("");
    } catch {
      // ignore
    }
  };

  const chatSenderName = (senderId: string) => {
    if (senderId === user?.id) return t("أنت", "You");
    const p = participants.find((x) => x.userId === senderId);
    if (p) {
      return p.role === "tutor" ? t("المعلم", "Tutor") : t("طالب", "Student");
    }
    return senderId.slice(0, 6);
  };

  const totalPages = Math.max(
    1,
    ...Object.keys(pages).map(Number),
    currentPage,
  );

  if (lessonLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-main)" }}
      >
        <p style={{ color: "var(--text-muted)" }}>
          {t("جاري تحميل الدرس...", "Loading lesson...")}
        </p>
      </div>
    );
  }

  if (lessonError || !lessonId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--bg-main)" }}
      >
        <p style={{ color: "var(--text-muted)" }}>
          {t("الدرس غير متاح أو انتهى", "Lesson unavailable or ended")}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push("/student")}
        >
          {t("العودة", "Go Back")}
        </button>
      </div>
    );
  }

  if (!joined) {
    const otherName =
      user?.role === "tutor"
        ? lesson?.student?.firstName
        : lesson?.tutor?.firstName;
    return (
      <main
        className="min-h-screen grid place-items-center p-4"
        style={{ background: "var(--canvas)", color: "var(--focus-ink)" }}
      >
        <section className="w-full max-w-3xl" aria-labelledby="preflight-title">
          <header className="text-center mb-6">
            <p className="text-xs mb-2" style={{ color: "var(--signal)" }}>
              {t("فصل MRH المباشر", "MRH native classroom")}
            </p>
            <h1
              id="preflight-title"
              className="text-2xl md:text-3xl font-semibold"
            >
              {otherName
                ? t(`درس مع ${otherName}`, `Lesson with ${otherName}`)
                : t("استعد للدرس", "Get ready for your lesson")}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--focus-muted)" }}>
              {t(
                "افحص الصوت والصورة قبل الدخول. يمكنك تغييرهما أثناء الدرس.",
                "Check your audio and video before joining. You can change them during the lesson.",
              )}
            </p>
          </header>

          <div
            className="grid md:grid-cols-[minmax(0,1fr)_220px] overflow-hidden rounded-[20px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="relative aspect-video grid place-items-center overflow-hidden"
              style={{ background: "var(--canvas-sunken)" }}
            >
              <video
                ref={preflightVideoRef}
                muted
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!cameraEnabled && (
                <div
                  className="absolute inset-0 grid place-items-center text-sm"
                  style={{
                    background: "var(--canvas-sunken)",
                    color: "var(--focus-muted)",
                  }}
                >
                  {t("الكاميرا متوقفة", "Camera is off")}
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button
                type="button"
                className="btn-secondary justify-between"
                aria-pressed={micEnabled}
                onClick={() => setMicEnabled((value) => !value)}
              >
                <span>{t("الميكروفون", "Microphone")}</span>
                <span>{micEnabled ? t("يعمل", "On") : t("متوقف", "Off")}</span>
              </button>
              <button
                type="button"
                className="btn-secondary justify-between"
                aria-pressed={cameraEnabled}
                onClick={() => setCameraEnabled((value) => !value)}
              >
                <span>{t("الكاميرا", "Camera")}</span>
                <span>
                  {cameraEnabled ? t("تعمل", "On") : t("متوقفة", "Off")}
                </span>
              </button>
              <button
                type="button"
                className="btn-secondary justify-between"
                aria-pressed={screenTested}
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getDisplayMedia(
                      { video: true },
                    );
                    stream.getTracks().forEach((track) => track.stop());
                    setScreenTested(true);
                  } catch {
                    setScreenTested(false);
                  }
                }}
              >
                <span>{t("مشاركة الشاشة", "Screen share")}</span>
                <span>{screenTested ? "✓" : t("فحص", "Test")}</span>
              </button>
            </div>
          </div>

          {preflightError && (
            <p
              role="alert"
              className="mt-4 text-sm"
              style={{ color: "var(--danger)" }}
            >
              {preflightError}
            </p>
          )}

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              className="btn-primary min-w-56"
              onClick={() => {
                preflightStream?.getTracks().forEach((track) => track.stop());
                setPreflightStream(null);
                setJoined(true);
              }}
            >
              {t("الدخول إلى الفصل", "Join classroom")}
            </button>
            {lesson?.googleMeetUrl && (
              <a
                href={lesson.googleMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm"
                style={{
                  color: "var(--focus-muted)",
                  textDecoration: "underline",
                }}
              >
                {t("استخدام رابط Meet الاحتياطي", "Use the Meet fallback")}
              </a>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: "var(--bg-main)" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-30 opacity-[0.045] overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 grid grid-cols-3 gap-24 -rotate-12 scale-150 place-items-center text-2xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index}>{user?.email || "MRH Academy"}</span>
          ))}
        </div>
      </div>
      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-2 md:px-4 py-2 shrink-0 flex-wrap gap-2"
        style={{
          background: "var(--canvas)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <span
            className="text-xs md:text-sm font-bold"
            style={{ color: "var(--focus-ink)" }}
          >
            {lesson?.title || t("غرفة الدرس", "Classroom")}
          </span>
          <span
            className="text-[10px] md:text-xs font-mono"
            style={{ color: "var(--focus-muted)" }}
          >
            {formatTime(elapsed)}
          </span>
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: "var(--surface-raised)" }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  rtt === null
                    ? "var(--ink-faint)"
                    : rtt < 150
                      ? "var(--success)"
                      : rtt < 500
                        ? "var(--warning)"
                        : "var(--danger)",
              }}
            />
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--focus-ink)" }}
            >
              {rtt === null
                ? t("جارٍ قياس الاتصال", "Measuring connection")
                : rtt < 150
                  ? `${t("اتصال جيد", "Good connection")} · ${rtt}ms`
                  : rtt < 500
                    ? `${t("اتصال متوسط", "Fair connection")} · ${rtt}ms`
                    : `${t("اتصال ضعيف", "Poor connection")} · ${rtt}ms`}
            </span>
          </div>
          {user?.role === "tutor" && participants.length > 0 && (
            <select
              value={focusedStudent || ""}
              onChange={(e) => setFocusedStudent(e.target.value || null)}
              className="text-xs px-2 py-1 rounded-lg max-w-[120px]"
              style={{
                background: "var(--ink-muted)",
                color: "var(--focus-ink)",
                border: "1px solid var(--ink-muted)",
              }}
            >
              <option value="">{t("كل الطلاب", "All Students")}</option>
              {participants
                .filter((p) => p.role === "student")
                .map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.userId.slice(0, 8)}
                  </option>
                ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <div
            className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
          />
          {lesson?.googleMeetUrl &&
            (showFallback || connectionStatus === "failed") && (
              <a
                href={lesson.googleMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs px-3 py-1.5"
                style={{ color: "var(--focus-ink)" }}
              >
                {t("فتح رابط Meet الاحتياطي", "Open Meet fallback")}
              </a>
            )}
          <button
            onClick={() => setShowReport(true)}
            className="btn-ghost text-xs px-3 py-1.5"
            style={{ color: "var(--focus-ink)" }}
          >
            <svg
              className="w-4 h-4 inline ms-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {t("بلّغ", "Report")}
          </button>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="btn-ghost text-xs px-3 py-1.5"
            style={{ color: "var(--danger)" }}
          >
            <svg
              className="w-4 h-4 inline ms-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            {t("مغادرة", "Leave")}
          </button>
        </div>
      </header>

      {/* Google Meet Fallback Banner */}
      {showFallback && lesson?.googleMeetUrl && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            background: "var(--danger-soft)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {t(
              "تعذر الاتصال المباشر بسبب إعدادات الشبكة",
              "Direct connection failed due to network settings",
            )}
          </p>
          <a
            href={lesson.googleMeetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--signal)", color: "var(--ink)" }}
          >
            {t("استمر عبر Google Meet", "Continue via Google Meet")}
          </a>
        </div>
      )}

      {showFallback && !lesson?.googleMeetUrl && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
          style={{
            background: "var(--danger-soft)",
            borderBottom: "1px solid var(--danger)",
          }}
        >
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--danger)" }}
            >
              {t(
                "تعذّر الاتصال المباشر بسبب إعدادات الشبكة.",
                "The direct connection failed because of the current network settings.",
              )}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
              {t(
                "سنواصل محاولة الاتصال داخل فصل MRH. يمكنك إعادة تشغيل الوسائط أو الإبلاغ عن المشكلة.",
                "We will keep trying inside the MRH classroom. You can restart your media or report the issue.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowReport(true)}
          >
            {t("الإبلاغ عن المشكلة", "Report issue")}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Whiteboard Area */}
        <div
          className="flex flex-col flex-1 min-w-0 order-2 lg:order-1"
          style={{ background: "var(--bg-main)" }}
        >
          {user?.role === "tutor" && (
            <ClassroomBookPanel
              lessonId={lessonId}
              activeBookId={bookSession?.bookId ?? null}
              onPresent={presentBook}
              onClose={closeBookPresentation}
              isPresenting={mainView === "book" && !!bookSession}
              t={t}
            />
          )}

          {/* View + Drawing Toolbar */}
          <div
            className="flex items-center gap-2 px-4 py-2 flex-wrap"
            style={{
              background: "var(--bg-light)",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div
              className="flex items-center gap-1 rounded-lg p-0.5"
              style={{ background: "var(--bg-main)" }}
            >
              <button
                type="button"
                onClick={() => setMainView("whiteboard")}
                className="min-h-11 px-3 rounded-md text-xs font-medium"
                aria-pressed={mainView === "whiteboard"}
                style={{
                  background:
                    mainView === "whiteboard" ? "var(--signal)" : "transparent",
                  color:
                    mainView === "whiteboard"
                      ? "var(--ink)"
                      : "var(--text-muted)",
                }}
              >
                {t("السبورة", "Whiteboard")}
              </button>
              <button
                type="button"
                onClick={() => bookSession && setMainView("book")}
                disabled={!bookSession}
                className="min-h-11 px-3 rounded-md text-xs font-medium disabled:opacity-40"
                aria-pressed={mainView === "book"}
                style={{
                  background:
                    mainView === "book" ? "var(--signal)" : "transparent",
                  color:
                    mainView === "book" ? "var(--ink)" : "var(--text-muted)",
                }}
              >
                {t("الكتاب", "Book")}
              </button>
            </div>

            {mainView === "whiteboard" && (
              <>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setToolColor(c);
                      setIsEraser(false);
                    }}
                    className="w-11 h-11 rounded-lg border-2 grid place-items-center"
                    aria-label={`${t("لون القلم", "Pen color")} ${c}`}
                    aria-pressed={toolColor === c && !isEraser}
                    style={{
                      background: "var(--surface)",
                      borderColor:
                        toolColor === c && !isEraser
                          ? "var(--signal)"
                          : "var(--border)",
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border"
                      style={{
                        background: c,
                        borderColor: "var(--border-strong)",
                      }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
                <div
                  className="w-px h-6"
                  style={{ background: "var(--border-color)" }}
                />
                {[2, 4, 6, 8].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setToolWidth(w);
                      setIsEraser(false);
                    }}
                    className="w-11 h-11 rounded-lg grid place-items-center"
                    aria-label={`${t("سُمك القلم", "Pen width")} ${w}`}
                    aria-pressed={toolWidth === w && !isEraser}
                    style={{
                      background:
                        toolWidth === w && !isEraser
                          ? "var(--signal-soft)"
                          : "var(--surface)",
                      border: `2px solid ${toolWidth === w && !isEraser ? "var(--signal)" : "var(--border)"}`,
                    }}
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: Math.max(4, w * 1.5),
                        height: Math.max(4, w * 1.5),
                        background: "var(--ink)",
                      }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
                <div
                  className="w-px h-6"
                  style={{ background: "var(--border-color)" }}
                />
                <button
                  type="button"
                  onClick={() => setIsEraser(!isEraser)}
                  className="min-h-11 px-3 rounded-lg text-xs font-medium"
                  aria-pressed={isEraser}
                  style={{
                    background: isEraser
                      ? "var(--primary-color)"
                      : "transparent",
                    color: isEraser ? "var(--ink)" : "var(--text-muted)",
                    border: "1px solid",
                    borderColor: isEraser
                      ? "var(--primary-color)"
                      : "var(--border-color)",
                  }}
                >
                  {t("ممحاة", "Eraser")}
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="min-h-11 px-3 rounded-lg text-xs font-medium"
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {t("تراجع", "Undo")}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="min-h-11 px-3 rounded-lg text-xs font-medium"
                  style={{
                    background: "transparent",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                  }}
                >
                  {t("مسح", "Clear")}
                </button>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changePage(-1)}
                    disabled={currentPage <= 1}
                    className="w-11 h-11 rounded text-xs disabled:opacity-30"
                    aria-label={t("الصفحة السابقة", "Previous page")}
                    style={{
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <DirectionalArrow direction="backward" />
                  </button>
                  <span
                    className="text-xs px-2 font-medium"
                    style={{ color: "var(--text-main)" }}
                  >
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => changePage(1)}
                    className="w-11 h-11 rounded text-xs"
                    aria-label={t("الصفحة التالية", "Next page")}
                    style={{
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <DirectionalArrow />
                  </button>
                </div>
              </>
            )}

            {mainView === "book" && bookSession && (
              <>
                <div
                  className="w-px h-6"
                  style={{ background: "var(--border-color)" }}
                />
                <span
                  className="text-xs font-medium truncate max-w-[180px]"
                  style={{ color: "var(--text-main)" }}
                >
                  {bookSession.title}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeBookPage(-1)}
                    disabled={bookSession.page <= 1 || user?.role !== "tutor"}
                    className="w-11 h-11 rounded text-xs disabled:opacity-30"
                    aria-label={t("صفحة الكتاب السابقة", "Previous book page")}
                    style={{
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <DirectionalArrow direction="backward" />
                  </button>
                  <span
                    className="text-xs px-2 font-medium"
                    style={{ color: "var(--text-main)" }}
                  >
                    {bookSession.page} / {bookSession.pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeBookPage(1)}
                    disabled={
                      bookSession.page >= bookSession.pageCount ||
                      user?.role !== "tutor"
                    }
                    className="w-11 h-11 rounded text-xs disabled:opacity-30"
                    aria-label={t("صفحة الكتاب التالية", "Next book page")}
                    style={{
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <DirectionalArrow />
                  </button>
                </div>
                {user?.role === "tutor" && (
                  <button
                    type="button"
                    onClick={closeBookPresentation}
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{
                      color: "var(--danger)",
                      border: "1px solid var(--danger)",
                    }}
                  >
                    {t("إيقاف", "Stop")}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Main canvas / book area */}
          <div className="flex-1 relative p-2 min-h-[320px]">
            {mainView === "book" && bookSession ? (
              <SecureBookViewer
                lessonId={lessonId}
                bookId={bookSession.bookId}
                page={bookSession.page}
                pageCount={bookSession.pageCount}
                title={bookSession.title}
                watermark={user?.email || user?.id || "MRH"}
                t={t}
              />
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full rounded-xl cursor-crosshair"
                style={{ background: "#ffffff", touchAction: "none" }}
              />
            )}
            {/* WebRTC Remote Video Overlay */}
            {Object.entries(remoteStreams).map(([pid, stream]) => (
              <div
                key={pid}
                className="absolute bottom-3 right-3 w-48 h-36 rounded-xl overflow-hidden shadow-xl border-2"
                style={{ borderColor: "var(--signal)", zIndex: 10 }}
              >
                <video
                  ref={(el) => {
                    if (el) el.srcObject = stream;
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {activeCall && localStreamRef.current && (
              <div
                className="absolute bottom-3 left-3 w-32 h-24 rounded-xl overflow-hidden shadow-lg border"
                style={{ borderColor: "var(--border-color)", zIndex: 10 }}
              >
                <video
                  ref={(el) => {
                    if (el) el.srcObject = localStreamRef.current;
                  }}
                  muted
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  aria-label={
                    activeCall === "screen"
                      ? t("معاينة الشاشة المشتركة", "Shared screen preview")
                      : t("معاينة الكاميرا", "Camera preview")
                  }
                />
              </div>
            )}
          </div>

          {/* WebRTC Buttons */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              background: "var(--bg-light)",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            {!peerUser ? (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t(
                  "انتظر حتى ينضم الطرف الآخر...",
                  "Waiting for the other participant to join...",
                )}
              </span>
            ) : (
              <>
                <button
                  onClick={() =>
                    activeCall === "voice"
                      ? stopCall("voice")
                      : startCall("voice")
                  }
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color:
                      activeCall === "voice"
                        ? "var(--success)"
                        : "var(--text-muted)",
                  }}
                >
                  <svg
                    className="w-4 h-4 inline ms-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    {activeCall === "voice" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                      />
                    )}
                  </svg>
                  {activeCall === "voice"
                    ? t("إنهاء المكالمة", "End Call")
                    : t("مكالمة صوتية", "Voice Call")}
                </button>
                <button
                  onClick={() =>
                    activeCall === "camera"
                      ? stopCall("camera")
                      : startCall("camera")
                  }
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color:
                      activeCall === "camera"
                        ? "var(--success)"
                        : "var(--text-muted)",
                  }}
                >
                  <svg
                    className="w-4 h-4 inline ms-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  {activeCall === "camera"
                    ? t("إيقاف الكاميرا", "Stop Camera")
                    : t("الكاميرا", "Camera")}
                </button>
                <button
                  onClick={() =>
                    activeCall === "screen"
                      ? stopCall("screen")
                      : startCall("screen")
                  }
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color:
                      activeCall === "screen"
                        ? "var(--success)"
                        : "var(--text-muted)",
                  }}
                >
                  <svg
                    className="w-4 h-4 inline ms-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
                    />
                  </svg>
                  {activeCall === "screen"
                    ? t("إيقاف المشاركة", "Stop Share")
                    : t("مشاركة الشاشة", "Screen Share")}
                </button>
              </>
            )}
            {callError && (
              <p
                className="text-xs w-full mt-1"
                style={{ color: "var(--danger)" }}
              >
                {callError}
              </p>
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div
          className="w-full lg:w-80 flex-shrink-0 flex flex-col order-1 lg:order-2 max-h-80 lg:max-h-none"
          style={{
            background: "var(--bg-light)",
            borderBottom: "1px solid var(--border-color)",
            borderInlineStart: "none",
          }}
        >
          {/* Tab Switcher */}
          <div
            className="flex"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <button
              onClick={() => setSideTab("chat")}
              className="flex-1 py-3 text-sm font-medium text-center transition-colors"
              style={{
                color:
                  sideTab === "chat" ? "var(--signal)" : "var(--text-muted)",
                borderBottom:
                  sideTab === "chat"
                    ? "2px solid var(--signal)"
                    : "2px solid transparent",
              }}
            >
              {t("الدردشة", "Chat")}
            </button>
            <button
              onClick={() => setSideTab("participants")}
              className="flex-1 py-3 text-sm font-medium text-center transition-colors"
              style={{
                color:
                  sideTab === "participants"
                    ? "var(--signal)"
                    : "var(--text-muted)",
                borderBottom:
                  sideTab === "participants"
                    ? "2px solid var(--signal)"
                    : "2px solid transparent",
              }}
            >
              {t("المشاركون", "Participants")} ({participants.length})
            </button>
          </div>

          {/* Chat Panel */}
          {sideTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <p
                    className="text-xs text-center mt-8"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("لا توجد رسائل بعد", "No messages yet")}
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
                  >
                    <span
                      className="text-[10px] font-medium mb-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {chatSenderName(msg.senderId)}
                    </span>
                    <div
                      className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                      style={{
                        background:
                          msg.senderId === user?.id
                            ? "var(--signal)"
                            : "var(--bg-main)",
                        color:
                          msg.senderId === user?.id
                            ? "var(--ink)"
                            : "var(--text-main)",
                      }}
                    >
                      {msg.content}
                    </div>
                    <span
                      className="text-[10px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString(
                        lang === "ar" ? "ar-SA" : "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div
                className="p-3"
                style={{ borderTop: "1px solid var(--border-color)" }}
              >
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChat();
                    }}
                    placeholder={t("اكتب رسالة...", "Type a message...")}
                    className="input-field text-sm flex-1"
                  />
                  <button
                    onClick={sendChat}
                    className="btn-primary px-3 py-2"
                    style={{ background: "var(--signal)", color: "var(--ink)" }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={
                          isRtl
                            ? "M14 5l-7 7 7 7"
                            : "M10 19l-7-7m0 0l7-7m-7 7h18"
                        }
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Participants Panel */}
          {sideTab === "participants" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {participants.length === 0 && (
                <p
                  className="text-xs text-center mt-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("لا يوجد مشاركون", "No participants")}
                </p>
              )}
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: "var(--bg-main)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background:
                        "color-mix(in srgb, var(--signal) 15%, transparent)",
                      color: "var(--signal)",
                    }}
                  >
                    {p.role === "tutor" ? "M" : "T"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-main)" }}
                    >
                      {p.userId === user?.id
                        ? t("أنت", "You")
                        : p.userId.slice(0, 8)}
                    </p>
                    <span
                      className="text-[10px] font-medium"
                      style={{
                        color:
                          p.role === "tutor"
                            ? "var(--signal)"
                            : "var(--text-muted)",
                      }}
                    >
                      {p.role === "tutor"
                        ? t("معلم", "Tutor")
                        : t("طالب", "Student")}
                    </span>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: (() => {
                        const r = healthMap[p.userId] ?? rtt;
                        if (r === null) return "var(--ink-faint)";
                        if (r < 150) return "var(--success)";
                        if (r < 500) return "var(--warning)";
                        return "var(--danger)";
                      })(),
                    }}
                    title={`${healthMap[p.userId] ?? rtt ?? "?"}ms`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showLeaveConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setShowLeaveConfirm(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-classroom-title"
            tabIndex={-1}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 shadow-xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--focus-ink)",
            }}
          >
            <h2 id="leave-classroom-title" className="text-xl font-semibold">
              {t("مغادرة الفصل؟", "Leave the classroom?")}
            </h2>
            <p className="mt-3 text-sm" style={{ color: "var(--focus-muted)" }}>
              {t(
                "ستنقطع الكاميرا والميكروفون ومشاركة الشاشة، وستعود إلى مساحة عملك. يمكنك الانضمام مجددًا ما دام الدرس متاحًا.",
                "Your camera, microphone, and screen share will stop, and you will return to your workspace. You may rejoin while the lesson remains available.",
              )}
            </p>
            <p className="mt-3 text-sm">
              {lesson?.title || t("درس مباشر على MRH", "Live lesson on MRH")} ·{" "}
              {formatTime(elapsed)}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLeaveConfirm(false)}
              >
                {t("البقاء", "Stay")}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleLeave}
              >
                {t("مغادرة الجلسة", "Leave session")}
              </button>
            </div>
          </div>
        </>
      )}

      {showReport && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowReport(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-classroom-title"
            tabIndex={-1}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-6 shadow-xl animate-scale-in"
            style={{
              background: "var(--bg-light)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3
              id="report-classroom-title"
              className="text-lg font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("الإبلاغ عن مشكلة", "Report an Issue")}
            </h3>
            <div className="space-y-3">
              <input
                value={reportSubject}
                onChange={(e) => setReportSubject(e.target.value)}
                placeholder={t("الموضوع", "Subject")}
                className="input-field text-sm"
              />
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder={t("الوصف (اختياري)", "Description (optional)")}
                rows={4}
                className="input-field text-sm resize-none"
              />
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowReport(false)}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  {t("إلغاء", "Cancel")}
                </button>
                <button
                  onClick={handleReportSubmit}
                  className="btn-primary text-sm px-4 py-2"
                  disabled={!reportSubject.trim()}
                >
                  {t("إرسال", "Submit")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

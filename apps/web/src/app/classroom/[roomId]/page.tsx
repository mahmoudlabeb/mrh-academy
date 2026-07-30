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
import { ClassroomIcon } from "@/components/classroom/ClassroomIcon";

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
  normalized?: boolean;
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

type ClassroomAccessState =
  | "allowed"
  | "waiting"
  | "cancelled"
  | "refunded"
  | "expired"
  | "closed"
  | "unpaid";

interface ClassroomAccess {
  state: ClassroomAccessState;
  canJoin: boolean;
  reason?: string;
  opensAt?: string;
  closesAt?: string;
  serverTime?: string;
}

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "var(--signal)"];
const ERASER_WIDTH = 30;

export const dynamic = "force-dynamic";

export default function ClassroomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
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
  const [roomError, setRoomError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [rtt, setRtt] = useState<number | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, number>>({});
  const [mainView, setMainView] = useState<"whiteboard" | "book">("whiteboard");
  const [canvasOpen, setCanvasOpen] = useState(false);
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
    error: lessonQueryError,
    isError: lessonError,
    isLoading: lessonLoading,
    refetch: refetchLesson,
  } = useQuery({
    queryKey: ["lesson-by-room", roomId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lessons/by-room/${roomId}`);
      return data as {
        id: string;
        status: string;
        title?: string;
        scheduledTime?: string;
        durationMinutes?: number;
        googleMeetUrl?: string;
        tutor?: { firstName?: string; lastName?: string };
        student?: { firstName?: string; lastName?: string };
        access?: ClassroomAccess;
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
    setMicrophoneEnabled,
    setCameraEnabled: setWebRtcCameraEnabled,
  } = useWebRTC(lessonId ?? "", user?.id || "", peerUser?.userId || null, {
    microphone: micEnabled,
    camera: cameraEnabled,
  });
  const autoStartedPeerRef = useRef<string | null>(null);

  const [showFallback, setShowFallback] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showMore, setShowMore] = useState(false);
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
    if (joined || !user || !lessonId || lesson?.access?.canJoin !== true)
      return;
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
  }, [roomId, joined, user, lessonId, lesson?.access?.canJoin]);

  useEffect(() => {
    preflightStream?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled, preflightStream]);

  useEffect(() => {
    preflightStream?.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
    setWebRtcCameraEnabled(cameraEnabled);
  }, [cameraEnabled, preflightStream, setWebRtcCameraEnabled]);

  useEffect(() => {
    setMicrophoneEnabled(micEnabled);
  }, [micEnabled, setMicrophoneEnabled]);

  useEffect(() => {
    if (
      !joined ||
      !peerUser?.userId ||
      !user?.id ||
      activeCall ||
      isCallLoading ||
      autoStartedPeerRef.current === peerUser.userId
    ) {
      return;
    }
    // A deterministic initiator prevents both participants from creating
    // competing offers when the second participant joins.
    if (user.id.localeCompare(peerUser.userId) < 0) {
      autoStartedPeerRef.current = peerUser.userId;
      void startCall(cameraEnabled ? "camera" : "voice");
    }
  }, [
    activeCall,
    cameraEnabled,
    isCallLoading,
    joined,
    peerUser?.userId,
    startCall,
    user?.id,
  ]);

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
      const scalePoint = (point: { x: number; y: number }) =>
        action.normalized
          ? {
              x: point.x * ctx.canvas.clientWidth,
              y: point.y * ctx.canvas.clientHeight,
            }
          : point;
      const firstPoint = scalePoint(action.points[0]);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < action.points.length; i++) {
        const point = scalePoint(action.points[i]);
        ctx.lineTo(point.x, point.y);
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
    const handleResize = () => {
      initCanvas();
      requestAnimationFrame(() => redrawPage(currentPage));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentPage, initCanvas, redrawPage]);

  useEffect(() => {
    if (!canvasOpen || mainView !== "whiteboard") return;
    requestAnimationFrame(() => {
      initCanvas();
      redrawPage(currentPage);
    });
  }, [canvasOpen, currentPage, initCanvas, mainView, redrawPage]);

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

    const onRoomError = (message: string) => {
      setRoomError(message);
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
        setCanvasOpen(false);
        setMainView("book");
      }
    };

    const onBookPageChange = (payload: { page: number }) => {
      setBookSession((prev) => (prev ? { ...prev, page: payload.page } : prev));
    };

    const onBookClose = () => {
      setBookSession(null);
      setCanvasOpen(true);
      setMainView("whiteboard");
    };

    const onPeerJoined = (p: Participant) => {
      setParticipants((prev) => {
        if (prev.some((x) => x.userId === p.userId)) return prev;
        return [...prev, p];
      });
    };

    const onRoomParticipants = (payload: { participants?: Participant[] }) => {
      setParticipants(
        (payload.participants ?? []).filter(
          (participant) => participant.userId !== user.id,
        ),
      );
    };

    const onPeerLeft = (p: { userId: string }) => {
      setParticipants((prev) => prev.filter((x) => x.userId !== p.userId));
      if (autoStartedPeerRef.current === p.userId) {
        autoStartedPeerRef.current = null;
      }
    };

    const onWhiteboardPageReplaced = (payload: {
      page: number;
      actions: DrawAction[];
    }) => {
      setPages((prev) => ({
        ...prev,
        [String(payload.page)]: payload.actions,
      }));
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

    socket.on("disconnect", onDisconnect);
    socket.on("error_message", onRoomError);
    socket.on("whiteboard_sync", onWhiteboardSync);
    socket.on("canvas_update", onCanvasUpdate);
    socket.on("chat_message", onChatMessage);
    socket.on("whiteboard_page_change", onPageChange);
    socket.on("book_sync", onBookSync);
    socket.on("book_page_change", onBookPageChange);
    socket.on("book_close", onBookClose);
    socket.on("peer_joined", onPeerJoined);
    socket.on("peer_left", onPeerLeft);
    socket.on("room_participants", onRoomParticipants);
    socket.on("whiteboard_page_replaced", onWhiteboardPageReplaced);

    if (socket.connected) {
      onConnect();
    } else {
      socket.on("connect", onConnect);
    }
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
      socket.off("error_message", onRoomError);
      socket.off("whiteboard_sync", onWhiteboardSync);
      socket.off("canvas_update", onCanvasUpdate);
      socket.off("chat_message", onChatMessage);
      socket.off("whiteboard_page_change", onPageChange);
      socket.off("book_sync", onBookSync);
      socket.off("book_page_change", onBookPageChange);
      socket.off("book_close", onBookClose);
      socket.off("peer_joined", onPeerJoined);
      socket.off("peer_left", onPeerLeft);
      socket.off("room_participants", onRoomParticipants);
      socket.off("whiteboard_page_replaced", onWhiteboardPageReplaced);
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

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
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

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const pos = getPointerPos(e);
    currentStroke.current.points.push(pos);

    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (e?.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const points = currentStroke.current.points;
    if (points.length < 2) return;
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;

    const action: DrawAction = {
      type: isEraser ? "erase" : "stroke",
      points: points.map((point) => ({
        x: point.x / rect.width,
        y: point.y / rect.height,
      })),
      color: isEraser ? "" : toolColor,
      width: isEraser ? ERASER_WIDTH : toolWidth,
      normalized: true,
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
      const nextActions = actions.slice(0, -1);
      getSocket().emit("whiteboard_page_replace", {
        lessonId,
        page: currentPage,
        actions: nextActions,
      });
      return { ...prev, [pageStr]: nextActions };
    });
  };

  const handleClear = () => {
    const pageStr = String(currentPage);
    setPages((prev) => ({ ...prev, [pageStr]: [] }));
    getSocket().emit("whiteboard_page_replace", {
      lessonId,
      page: currentPage,
      actions: [],
    });
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
    setCanvasOpen(false);
    setMainView("book");
  };

  const closeBookPresentation = () => {
    if (!lessonId) return;
    const socket = getSocket();
    socket.emit("book_close", { lessonId });
    setBookSession(null);
    setCanvasOpen(true);
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
  const participantName = (
    participant?: { firstName?: string; lastName?: string } | null,
  ) =>
    [participant?.firstName, participant?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

  if (authLoading || lessonLoading) {
    return (
      <main
        className="classroom-access-state classroom-shell"
        data-testid="classroom-state"
        data-access-state="loading"
        aria-busy="true"
      >
        <div className="classroom-access-card" role="status">
          <span className="classroom-access-loader" />
          <h1>{t("جارٍ تجهيز الفصل", "Preparing your classroom")}</h1>
          <p>
            {t(
              "نتحقق من الحجز والدفع وموعد الدرس…",
              "Checking your booking, payment, and lesson time…",
            )}
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="classroom-access-state classroom-shell"
        data-testid="classroom-state"
        data-access-state="unauthenticated"
      >
        <div className="classroom-access-card">
          <span className="classroom-access-icon">
            <ClassroomIcon name="user" />
          </span>
          <h1>{t("سجّل الدخول للمتابعة", "Sign in to continue")}</h1>
          <p>
            {t(
              "يجب تسجيل الدخول بالحساب المرتبط بهذا الحجز.",
              "Use the account connected to this booking.",
            )}
          </p>
          <button type="button" onClick={() => router.push(`/${lang}/sign-in`)}>
            {t("تسجيل الدخول", "Sign in")}
          </button>
        </div>
      </main>
    );
  }

  if (lessonError || !lessonId) {
    const responseStatus = (
      lessonQueryError as { response?: { status?: number } } | null
    )?.response?.status;
    const denied = responseStatus === 401 || responseStatus === 403;
    return (
      <main
        className="classroom-access-state classroom-shell"
        data-testid="classroom-state"
        data-access-state={denied ? "denied" : "error"}
      >
        <div
          className="classroom-access-card"
          role={denied ? "alert" : "status"}
        >
          <span className="classroom-access-icon is-danger">
            <ClassroomIcon name={denied ? "close" : "info"} />
          </span>
          <h1>
            {denied
              ? t("لا يمكنك دخول هذا الفصل", "You cannot enter this classroom")
              : t("تعذّر فتح الفصل", "We could not open the classroom")}
          </h1>
          <p>
            {denied
              ? t(
                  "هذا الفصل متاح فقط للطالب والمعلم المسجلين في الحجز المؤكد والمدفوع.",
                  "Only the student and tutor on the confirmed paid booking can enter.",
                )
              : t(
                  "تحقق من اتصالك ثم حاول مجددًا. قد يكون رابط الفصل غير صحيح.",
                  "Check your connection and try again. The classroom link may also be invalid.",
                )}
          </p>
          <div className="classroom-access-actions">
            {!denied && (
              <button type="button" onClick={() => void refetchLesson()}>
                <ClassroomIcon name="retry" />
                {t("إعادة المحاولة", "Try again")}
              </button>
            )}
            <button
              type="button"
              className="is-secondary"
              onClick={() =>
                router.push(user.role === "tutor" ? "/tutor" : "/student")
              }
            >
              {t("العودة إلى مساحتي", "Back to my workspace")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (lesson.access?.canJoin !== true) {
    const accessState = lesson.access?.state ?? "closed";
    const copy: Record<ClassroomAccessState, { title: string; body: string }> =
      {
        allowed: {
          title: t("الفصل جاهز", "Classroom ready"),
          body: t("يمكنك الدخول الآن.", "You can join now."),
        },
        waiting: {
          title: t("لم يحن موعد الدخول بعد", "Your classroom is not open yet"),
          body: t(
            "حجزك مؤكد ومدفوع. سيُفتح الفصل تلقائيًا داخل نافذة الدخول المسموحة.",
            "Your booking is confirmed and paid. The classroom opens automatically within the allowed join window.",
          ),
        },
        cancelled: {
          title: t("تم إلغاء هذا الدرس", "This lesson was cancelled"),
          body: t(
            "لا يمكن دخول فصل لحجز ملغي.",
            "A cancelled booking cannot enter the classroom.",
          ),
        },
        refunded: {
          title: t("تم رد قيمة الحجز", "This booking was refunded"),
          body: t(
            "لم يعد هذا الفصل متاحًا بعد استرداد الدفع.",
            "This classroom is no longer available after a refund.",
          ),
        },
        expired: {
          title: t("انتهت نافذة الدرس", "The lesson window has expired"),
          body: t(
            "انتهى وقت الدخول لهذا الدرس.",
            "The entry window for this lesson has ended.",
          ),
        },
        closed: {
          title: t("الفصل مغلق", "Classroom closed"),
          body: t(
            "هذا الفصل غير متاح للدخول حاليًا.",
            "This classroom is not available to enter right now.",
          ),
        },
        unpaid: {
          title: t("الدفع غير مكتمل", "Payment is not complete"),
          body: t(
            "يُفتح الفصل فقط بعد تأكيد الدفع للحجز.",
            "The classroom opens only after booking payment is confirmed.",
          ),
        },
      };
    const stateCopy = copy[accessState];
    const opensAt = lesson.access?.opensAt
      ? new Date(lesson.access.opensAt).toLocaleString(
          lang === "ar" ? "ar-EG" : "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        )
      : null;
    return (
      <main
        className="classroom-access-state classroom-shell"
        data-testid="classroom-state"
        data-access-state={accessState}
      >
        <div className="classroom-access-card" role="status">
          <span
            className={`classroom-access-icon ${accessState === "waiting" ? "is-waiting" : "is-danger"}`}
          >
            <ClassroomIcon
              name={accessState === "waiting" ? "info" : "close"}
            />
          </span>
          <p className="classroom-access-kicker">
            {lesson.title || t("درس مباشر", "Live lesson")}
          </p>
          <h1>{stateCopy.title}</h1>
          <p>{stateCopy.body}</p>
          {accessState === "waiting" && opensAt && (
            <div className="classroom-opening-time">
              <span>{t("موعد فتح الفصل", "Classroom opens")}</span>
              <strong>{opensAt}</strong>
            </div>
          )}
          <div className="classroom-access-actions">
            {accessState === "waiting" && (
              <button type="button" onClick={() => void refetchLesson()}>
                <ClassroomIcon name="retry" />
                {t("تحقق من الموعد", "Check again")}
              </button>
            )}
            <button
              type="button"
              className="is-secondary"
              onClick={() =>
                router.push(user.role === "tutor" ? "/tutor" : "/student")
              }
            >
              {t("العودة إلى مساحتي", "Back to my workspace")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!joined) {
    const otherName =
      user?.role === "tutor"
        ? participantName(lesson?.student)
        : participantName(lesson?.tutor);
    return (
      <main
        className="classroom-preflight classroom-shell"
        data-testid="classroom-preflight"
      >
        <header className="classroom-topbar">
          <div className="classroom-room-id">
            <span className="classroom-room-id__icon">
              <ClassroomIcon name="user" />
            </span>
            <div>
              <h1>{lesson.title || t("غرفة الدرس", "Classroom")}</h1>
              <p>
                {otherName
                  ? t(`درس مع ${otherName}`, `Lesson with ${otherName}`)
                  : t("درس مباشر", "Live lesson")}
              </p>
            </div>
          </div>
          <span className="classroom-status-chip">
            <span className="classroom-status-dot is-ready" />
            {t("الحجز مؤكد ومدفوع", "Confirmed & paid")}
          </span>
        </header>
        <section
          className="classroom-preflight__body"
          aria-labelledby="preflight-title"
        >
          <div className="classroom-preflight__copy">
            <p className="classroom-access-kicker">
              {t("فحص ما قبل الدرس", "Pre-class check")}
            </p>
            <h1 id="preflight-title">
              {otherName
                ? t(`درس مع ${otherName}`, `Lesson with ${otherName}`)
                : t("استعد للدرس", "Get ready for your lesson")}
            </h1>
            <p>
              {t(
                "افحص الصوت والصورة قبل الدخول. يمكنك تغييرهما أثناء الدرس.",
                "Check your audio and video before joining. You can change them during the lesson.",
              )}
            </p>
            {(lesson.scheduledTime || lesson.durationMinutes) && (
              <div className="classroom-preflight__lesson-meta">
                {lesson.scheduledTime && (
                  <span>
                    {new Date(lesson.scheduledTime).toLocaleString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { dateStyle: "medium", timeStyle: "short" },
                    )}
                  </span>
                )}
                {lesson.durationMinutes && (
                  <span>
                    {lesson.durationMinutes} {t("دقيقة", "minutes")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="classroom-preflight__grid">
            <div className="classroom-preflight__preview">
              <video ref={preflightVideoRef} muted autoPlay playsInline />
              {(!cameraEnabled || !preflightStream) && (
                <div className="classroom-video-placeholder">
                  <ClassroomIcon name={preflightError ? "cameraOff" : "user"} />
                  <span>
                    {preflightError
                      ? t("تعذّر فتح الكاميرا", "Camera unavailable")
                      : t("جارٍ تجهيز المعاينة…", "Preparing preview…")}
                  </span>
                </div>
              )}
              <span className="classroom-video-label">
                {t("معاينتك", "Your preview")}
              </span>
            </div>
            <div className="classroom-preflight__controls">
              <h2>{t("الأجهزة", "Devices")}</h2>
              <button
                type="button"
                aria-pressed={micEnabled}
                onClick={() => setMicEnabled((value) => !value)}
              >
                <ClassroomIcon name={micEnabled ? "mic" : "micOff"} />
                <span>
                  <strong>{t("الميكروفون", "Microphone")}</strong>
                  <small>
                    {micEnabled ? t("يعمل", "On") : t("متوقف", "Off")}
                  </small>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={cameraEnabled}
                onClick={() => setCameraEnabled((value) => !value)}
              >
                <ClassroomIcon name={cameraEnabled ? "camera" : "cameraOff"} />
                <span>
                  <strong>{t("الكاميرا", "Camera")}</strong>
                  <small>
                    {cameraEnabled ? t("تعمل", "On") : t("متوقفة", "Off")}
                  </small>
                </span>
              </button>
              <button
                type="button"
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
                <ClassroomIcon name={screenTested ? "check" : "screen"} />
                <span>
                  <strong>{t("مشاركة الشاشة", "Screen share")}</strong>
                  <small>
                    {screenTested ? t("جاهزة", "Ready") : t("اختبار", "Test")}
                  </small>
                </span>
              </button>
            </div>
          </div>

          {preflightError && (
            <p role="alert" className="classroom-preflight__error">
              <ClassroomIcon name="cameraOff" />
              {preflightError}
            </p>
          )}

          <div className="classroom-preflight__actions">
            <button
              type="button"
              data-testid="join-classroom"
              onClick={() => {
                if (lesson.access?.canJoin !== true) return;
                preflightStream?.getTracks().forEach((track) => track.stop());
                setPreflightStream(null);
                setJoined(true);
              }}
            >
              <ClassroomIcon name="leave" />
              {t("الدخول إلى الفصل", "Join classroom")}
            </button>
            {lesson?.googleMeetUrl && (
              <a
                href={lesson.googleMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="classroom-preflight__fallback"
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
      className="classroom-shell min-h-screen flex flex-col select-none"
      data-testid="classroom-shell"
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
      <header className="classroom-topbar">
        <div className="classroom-room-id">
          <span className="classroom-room-id__icon">
            <ClassroomIcon name="user" />
          </span>
          <div>
            <h1>{lesson?.title || t("غرفة الدرس", "Classroom")}</h1>
            <p>
              {user.role === "tutor"
                ? t(
                    `مع ${participantName(lesson.student) || "الطالب"}`,
                    `With ${participantName(lesson.student) || "student"}`,
                  )
                : t(
                    `مع ${participantName(lesson.tutor) || "المعلم"}`,
                    `With ${participantName(lesson.tutor) || "tutor"}`,
                  )}
              {" · "}
              {formatTime(elapsed)}
            </p>
          </div>
        </div>

        <div className="classroom-top-actions">
          <span className="classroom-status-chip">
            <span
              className={`classroom-status-dot ${connected ? "is-ready" : ""}`}
            />
            {connectionStatus === "failed"
              ? t("فشل الاتصال", "Connection failed")
              : rtt === null
                ? t("جارٍ الاتصال", "Connecting")
                : rtt < 150
                  ? t("اتصال جيد", "Good connection")
                  : rtt < 500
                    ? t("اتصال متوسط", "Fair connection")
                    : t("اتصال ضعيف", "Poor connection")}
          </span>
          {lesson?.googleMeetUrl &&
            (showFallback || connectionStatus === "failed") && (
              <a
                href={lesson.googleMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="classroom-top-fallback"
              >
                {t("Meet الاحتياطي", "Meet fallback")}
              </a>
            )}
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="classroom-icon-button"
            aria-label={t("معلومات الفصل", "Classroom information")}
          >
            <ClassroomIcon name="info" />
          </button>
          <button
            type="button"
            className="classroom-icon-button"
            aria-label={t("جودة الاتصال", "Connection quality")}
            onClick={() => setShowMore(true)}
          >
            <ClassroomIcon name="signal" />
          </button>
        </div>
      </header>
      {roomError && (
        <div
          role="alert"
          className="px-4 py-2 text-sm"
          style={{
            color: "var(--danger)",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          }}
        >
          {roomError}
        </div>
      )}

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
      <div className="classroom-content flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Whiteboard Area */}
        <div
          className="classroom-stage flex flex-col flex-1 min-w-0 order-2 lg:order-1"
          style={{ background: "var(--bg-main)" }}
        >
          {user?.role === "tutor" && showTools && (
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
            className={`classroom-toolbar flex items-center gap-2 px-4 py-2 flex-wrap ${showTools ? "is-open" : ""}`}
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
                onClick={() => {
                  setMainView("whiteboard");
                  setCanvasOpen(true);
                }}
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
          <div
            className="classroom-stage-surface flex-1 relative p-2 min-h-[320px]"
            data-testid="classroom-stage"
          >
            {mainView === "whiteboard" && !canvasOpen && (
              <div className="classroom-stage-empty" role="status">
                <div className="classroom-stage-empty__icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5 19.5 8.25v7.5l-3.75-2.25M4.5 18.75h8.25A2.25 2.25 0 0 0 15 16.5v-9a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                </div>
                <h2>
                  {peerUser
                    ? t("جارٍ إنشاء الاتصال", "Connecting your call")
                    : t(
                        "بانتظار الطرف الآخر",
                        "Waiting for the other participant",
                      )}
                </h2>
                <p>
                  {peerUser
                    ? t(
                        "حافظ على هذه الصفحة مفتوحة بينما نُنشئ اتصالًا مباشرًا وآمنًا.",
                        "Keep this page open while we establish a secure direct connection.",
                      )
                    : t(
                        "يمكنك استخدام السبورة أو تجهيز أدواتك. سنوصلكما تلقائيًا عند الانضمام.",
                        "You can use the canvas or prepare your tools. We will connect you automatically when they join.",
                      )}
                </p>
              </div>
            )}
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
            ) : canvasOpen ? (
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-full rounded-xl cursor-crosshair"
                style={{ background: "#ffffff", touchAction: "none" }}
              />
            ) : null}
            {/* WebRTC Remote Video Overlay */}
            {Object.entries(remoteStreams).map(([pid, stream]) => (
              <div
                key={pid}
                className="classroom-remote-tile absolute top-3 right-3 w-48 h-36 rounded-xl overflow-hidden shadow-xl border-2"
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
                className="classroom-local-tile absolute bottom-3 left-3 w-32 h-24 rounded-xl overflow-hidden shadow-lg border"
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
            className="classroom-media-controls classroom-dock"
            data-testid="classroom-dock"
          >
            <div className="classroom-dock__controls">
              <button
                type="button"
                data-dock-action="mic"
                onClick={() => {
                  if (!activeCall && peerUser) {
                    void startCall("voice");
                  } else {
                    setMicEnabled((enabled) => !enabled);
                  }
                }}
                disabled={isCallLoading}
                className={micEnabled ? "is-active" : ""}
                aria-pressed={micEnabled}
                aria-label={
                  micEnabled
                    ? t("كتم الميكروفون", "Mute microphone")
                    : t("تشغيل الميكروفون", "Unmute microphone")
                }
              >
                <span>
                  <ClassroomIcon name={micEnabled ? "mic" : "micOff"} />
                </span>
                <small>{t("الميكروفون", "Mic")}</small>
              </button>
              <button
                type="button"
                data-dock-action="camera"
                onClick={() => {
                  if ((!activeCall || activeCall === "voice") && peerUser) {
                    setCameraEnabled(true);
                    setWebRtcCameraEnabled(true);
                    void startCall("camera");
                  } else {
                    setCameraEnabled((enabled) => !enabled);
                  }
                }}
                disabled={isCallLoading}
                className={cameraEnabled ? "is-active" : ""}
                aria-pressed={cameraEnabled}
                aria-label={
                  cameraEnabled
                    ? t("إيقاف الكاميرا", "Turn camera off")
                    : t("تشغيل الكاميرا", "Turn camera on")
                }
              >
                <span>
                  <ClassroomIcon
                    name={cameraEnabled ? "camera" : "cameraOff"}
                  />
                </span>
                <small>{t("الكاميرا", "Camera")}</small>
              </button>
              <button
                type="button"
                data-dock-action="canvas"
                className={
                  mainView === "whiteboard" && canvasOpen ? "is-active" : ""
                }
                aria-pressed={mainView === "whiteboard" && canvasOpen}
                onClick={() => {
                  setMainView("whiteboard");
                  setCanvasOpen(true);
                }}
                aria-label={t("فتح السبورة", "Open canvas")}
              >
                <span>
                  <ClassroomIcon name="board" />
                </span>
                <small>{t("السبورة", "Canvas")}</small>
              </button>
              <button
                type="button"
                data-dock-action="tools"
                className={showTools ? "is-active" : ""}
                aria-pressed={showTools}
                onClick={() => {
                  setMainView("whiteboard");
                  setCanvasOpen(true);
                  setShowTools((value) => !value);
                }}
                aria-label={t("أدوات السبورة", "Teaching tools")}
              >
                <span>
                  <ClassroomIcon name="tools" />
                </span>
                <small>{t("الأدوات", "Tools")}</small>
              </button>
              <button
                type="button"
                data-dock-action="share"
                className={activeCall === "screen" ? "is-active" : ""}
                aria-pressed={activeCall === "screen"}
                onClick={() =>
                  activeCall === "screen"
                    ? stopCall("screen")
                    : void startCall("screen")
                }
                disabled={isCallLoading || !peerUser}
                aria-label={
                  activeCall === "screen"
                    ? t("إيقاف مشاركة الشاشة", "Stop screen sharing")
                    : t("مشاركة الشاشة", "Share screen")
                }
              >
                <span>
                  <ClassroomIcon name="screen" />
                </span>
                <small>{t("مشاركة", "Share")}</small>
              </button>
              <button
                type="button"
                data-dock-action="chat"
                className={
                  showSidePanel && sideTab === "chat" ? "is-active" : ""
                }
                aria-pressed={showSidePanel && sideTab === "chat"}
                onClick={() => {
                  setSideTab("chat");
                  setShowSidePanel((value) => sideTab !== "chat" || !value);
                }}
                aria-label={t("فتح الدردشة", "Open chat")}
              >
                <span>
                  <ClassroomIcon name="chat" />
                </span>
                <small>{t("الدردشة", "Chat")}</small>
              </button>
              <button
                type="button"
                data-dock-action="more"
                className={showMore ? "is-active" : ""}
                aria-pressed={showMore}
                onClick={() => setShowMore((value) => !value)}
                aria-label={t("المزيد من الإجراءات", "More actions")}
              >
                <span>
                  <ClassroomIcon name="more" />
                </span>
                <small>{t("المزيد", "More")}</small>
              </button>
              <button
                type="button"
                data-dock-action="leave"
                className="classroom-dock__leave"
                onClick={() => setShowLeaveConfirm(true)}
                aria-label={t("مغادرة الفصل", "Leave classroom")}
              >
                <span>
                  <ClassroomIcon name="leave" />
                </span>
                <small>{t("مغادرة", "Leave")}</small>
              </button>
            </div>
            {callError && (
              <p className="classroom-call-error" role="alert">
                {callError}
              </p>
            )}
          </div>
        </div>

        {/* Side Panel */}
        {showSidePanel && (
          <div
            className="classroom-sidepanel flex flex-col"
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
              <button
                type="button"
                className="classroom-sidepanel__close"
                onClick={() => setShowSidePanel(false)}
                aria-label={t("إغلاق اللوحة", "Close panel")}
              >
                <ClassroomIcon name="close" />
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
                      style={{
                        background: "var(--signal)",
                        color: "var(--ink)",
                      }}
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
        )}
      </div>

      {showMore && (
        <>
          <button
            type="button"
            className="classroom-panel-scrim"
            aria-label={t("إغلاق قائمة المزيد", "Close more menu")}
            onClick={() => setShowMore(false)}
          />
          <aside
            className="classroom-popover classroom-more-panel"
            aria-label={t("المزيد من الإجراءات", "More actions")}
          >
            <button
              type="button"
              className="classroom-popover__close"
              onClick={() => setShowMore(false)}
              aria-label={t("إغلاق القائمة", "Close menu")}
            >
              <ClassroomIcon name="close" />
            </button>
            <h2>{t("الفصل والاتصال", "Classroom & connection")}</h2>
            <div className="classroom-detail-list">
              <span>
                <ClassroomIcon name="participants" />
                {t("المشاركون", "Participants")}
                <b>{participants.length + 1}</b>
              </span>
              <span>
                <ClassroomIcon name="signal" />
                {t("زمن الاستجابة", "Latency")}
                <b>{rtt === null ? "—" : `${rtt}ms`}</b>
              </span>
              <span>
                <ClassroomIcon name="info" />
                {t("مدة الجلسة", "Session time")}
                <b>{formatTime(elapsed)}</b>
              </span>
              {lesson.scheduledTime && (
                <span>
                  <ClassroomIcon name="info" />
                  {t("موعد الدرس", "Scheduled")}
                  <b>
                    {new Date(lesson.scheduledTime).toLocaleTimeString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </b>
                </span>
              )}
              {lesson.durationMinutes && (
                <span>
                  <ClassroomIcon name="info" />
                  {t("المدة", "Duration")}
                  <b>
                    {lesson.durationMinutes} {t("د", "min")}
                  </b>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTools(true);
                setShowMore(false);
              }}
            >
              <ClassroomIcon name="tools" />
              <span>
                <strong>{t("أدوات التدريس", "Teaching tools")}</strong>
                <small>
                  {t(
                    "افتح أدوات السبورة والكتاب",
                    "Open whiteboard and book controls",
                  )}
                </small>
              </span>
            </button>
            <button
              type="button"
              disabled={isCallLoading || !peerUser}
              onClick={() => {
                if (activeCall === "screen") {
                  stopCall("screen");
                } else {
                  void startCall("screen");
                }
                setShowMore(false);
              }}
            >
              <ClassroomIcon name="screen" />
              <span>
                <strong>
                  {activeCall === "screen"
                    ? t("إيقاف مشاركة الشاشة", "Stop screen sharing")
                    : t("مشاركة الشاشة", "Share screen")}
                </strong>
                <small>
                  {peerUser
                    ? t(
                        "شارك نافذة أو شاشة كاملة",
                        "Share a window or full screen",
                      )
                    : t(
                        "متاحة عند انضمام الطرف الآخر",
                        "Available when the other participant joins",
                      )}
                </small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSideTab("participants");
                setShowSidePanel(true);
                setShowMore(false);
              }}
            >
              <ClassroomIcon name="participants" />
              <span>
                <strong>{t("عرض المشاركين", "View participants")}</strong>
                <small>
                  {peerUser
                    ? t("الطرف الآخر متصل", "The other participant is here")
                    : t(
                        "بانتظار الطرف الآخر",
                        "Waiting for the other participant",
                      )}
                </small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReport(true);
                setShowMore(false);
              }}
            >
              <ClassroomIcon name="info" />
              <span>
                <strong>{t("الإبلاغ عن مشكلة", "Report an issue")}</strong>
                <small>
                  {t(
                    "أرسل تفاصيل المشكلة إلى فريق الدعم",
                    "Send issue details to support",
                  )}
                </small>
              </span>
            </button>
            {lesson.googleMeetUrl && (
              <a
                href={lesson.googleMeetUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ClassroomIcon name="screen" />
                <span>
                  <strong>
                    {t("فتح Meet الاحتياطي", "Open Meet fallback")}
                  </strong>
                  <small>
                    {t(
                      "استخدمه عند تعذّر الاتصال المباشر",
                      "Use when the direct connection fails",
                    )}
                  </small>
                </span>
              </a>
            )}
          </aside>
        </>
      )}

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

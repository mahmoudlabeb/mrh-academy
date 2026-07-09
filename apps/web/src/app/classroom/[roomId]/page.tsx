'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { SecureBookViewer } from '@/components/classroom/SecureBookViewer';
import {
  ClassroomBookPanel,
  type LessonBookMeta,
} from '@/components/classroom/ClassroomBookPanel';

interface ChatMessage {
  senderId: string;
  content: string;
  timestamp: string;
}

interface DrawAction {
  type: 'stroke' | 'erase';
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

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#D4A353'];
const ERASER_WIDTH = 30;

export const dynamic = 'force-dynamic';

export default function ClassroomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { lang, dir } = useLanguage();
  const isRtl = dir === 'rtl';

  const t = (ar: string, en: string) => (dir === 'rtl' ? ar : en);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<{ points: { x: number; y: number }[] }>({ points: [] });

  const [toolColor, setToolColor] = useState('#000000');
  const [toolWidth, setToolWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [pages, setPages] = useState<Record<string, DrawAction[]>>({ '1': [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sideTab, setSideTab] = useState<'chat' | 'participants'>('chat');
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [focusedStudent, setFocusedStudent] = useState<string | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, number>>({});
  const [mainView, setMainView] = useState<'whiteboard' | 'book'>('whiteboard');
  const [bookSession, setBookSession] = useState<BookSessionState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rttPingRef = useRef<number | null>(null);

  const { data: lesson, isError: lessonError, isLoading: lessonLoading } = useQuery({
    queryKey: ['lesson-by-room', roomId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/lessons/by-room/${roomId}`);
      return data as { id: string; status: string; title?: string; tutor?: { firstName?: string }; student?: { firstName?: string } };
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
    startCall,
    stopCall,
  } = useWebRTC(lessonId ?? '', user?.id || '', peerUser?.userId || null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;
    }
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, action: DrawAction) => {
    if (action.points.length < 2) return;
    ctx.beginPath();
    if (action.type === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = action.width;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.width;
    }
    ctx.moveTo(action.points[0].x, action.points[0].y);
    for (let i = 1; i < action.points.length; i++) {
      ctx.lineTo(action.points[i].x, action.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  const redrawPage = useCallback((pageNum: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
    const pageActions = pages[String(pageNum)] || [];
    for (const action of pageActions) {
      drawStroke(ctx, action);
    }
  }, [pages, drawStroke]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  useEffect(() => {
    if (canvasRef.current && ctxRef.current) {
      redrawPage(currentPage);
    }
  }, [currentPage, pages, redrawPage]);

  useEffect(() => {
    if (!user || !roomId || !lessonId) return;
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_lesson', { lessonId });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onWhiteboardSync = (state: WhiteboardState) => {
      setPages(state.pages || { '1': [] });
      setCurrentPage(state.currentPage || 1);
    };

    const onCanvasUpdate = (payload: { userId: string; page: number; data: DrawAction }) => {
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
        setMainView('book');
      }
    };

    const onBookPageChange = (payload: { page: number }) => {
      setBookSession((prev) => (prev ? { ...prev, page: payload.page } : prev));
    };

    const onBookClose = () => {
      setBookSession(null);
      setMainView('whiteboard');
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

    if (socket.connected) {
      onConnect();
    } else {
      socket.on('connect', onConnect);
    }

    const onPongHealth = (payload: { timestamp: number; serverTime: number }) => {
      const now = Date.now();
      const measuredRtt = now - payload.timestamp;
      setRtt(measuredRtt);
      if (rttPingRef.current) {
        clearTimeout(rttPingRef.current);
      }
      rttPingRef.current = window.setTimeout(() => {
        socket.emit('health_report', { lessonId, rtt: measuredRtt });
      }, 100);
    };

    const onConnectionHealth = (payload: { participants: { userId: string; rtt: number }[] }) => {
      const map: Record<string, number> = {};
      for (const p of payload.participants) {
        map[p.userId] = p.rtt;
      }
      setHealthMap(map);
    };

    let healthInterval: ReturnType<typeof setInterval> | null = null;

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('whiteboard_sync', onWhiteboardSync);
    socket.on('canvas_update', onCanvasUpdate);
    socket.on('chat_message', onChatMessage);
    socket.on('whiteboard_page_change', onPageChange);
    socket.on('book_sync', onBookSync);
    socket.on('book_page_change', onBookPageChange);
    socket.on('book_close', onBookClose);
    socket.on('peer_joined', onPeerJoined);
    socket.on('peer_left', onPeerLeft);
    socket.on('pong_health', onPongHealth);
    socket.on('connection_health', onConnectionHealth);

    if (socket.connected) {
      onConnect();
    }

    healthInterval = setInterval(() => {
      socket.emit('ping_health', { timestamp: Date.now() });
    }, 5000);

    return () => {
      if (healthInterval) clearInterval(healthInterval);
      if (rttPingRef.current) clearTimeout(rttPingRef.current);
      socket.emit('leave_lesson', { lessonId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('whiteboard_sync', onWhiteboardSync);
      socket.off('canvas_update', onCanvasUpdate);
      socket.off('chat_message', onChatMessage);
      socket.off('whiteboard_page_change', onPageChange);
      socket.off('book_sync', onBookSync);
      socket.off('book_page_change', onBookPageChange);
      socket.off('book_close', onBookClose);
      socket.off('peer_joined', onPeerJoined);
      socket.off('peer_left', onPeerLeft);
      socket.off('pong_health', onPongHealth);
      socket.off('connection_health', onConnectionHealth);
    };
  }, [user, lessonId, roomId]);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = ERASER_WIDTH;
    } else {
      ctx.globalCompositeOperation = 'source-over';
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
      type: isEraser ? 'erase' : 'stroke',
      points: [...points],
      color: isEraser ? '' : toolColor,
      width: isEraser ? ERASER_WIDTH : toolWidth,
    };

    const pageStr = String(currentPage);
    setPages((prev) => ({
      ...prev,
      [pageStr]: [...(prev[pageStr] || []), action],
    }));

    const socket = getSocket();
    socket.emit('canvas_draw', { lessonId, page: currentPage, data: action });
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
    socket.emit('whiteboard_page_change', { lessonId, page: newPage });
  };

  const changeBookPage = (delta: number) => {
    if (!bookSession || !lessonId) return;
    const newPage = Math.max(
      1,
      Math.min(bookSession.pageCount, bookSession.page + delta),
    );
    setBookSession((prev) => (prev ? { ...prev, page: newPage } : prev));
    if (user?.role === 'tutor') {
      const socket = getSocket();
      socket.emit('book_page_change', { lessonId, page: newPage });
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
    socket.emit('book_present', payload);
    setBookSession({
      active: true,
      bookId: book.id,
      title: book.title,
      pageCount: book.pageCount,
      page: 1,
    });
    setMainView('book');
  };

  const closeBookPresentation = () => {
    if (!lessonId) return;
    const socket = getSocket();
    socket.emit('book_close', { lessonId });
    setBookSession(null);
    setMainView('whiteboard');
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit('send_chat', { lessonId, content: chatInput.trim() });
    setChatInput('');
  };

  const handleLeave = () => {
    const socket = getSocket();
    socket.emit('leave_lesson', { lessonId });
    disconnectSocket();
    router.push('/student');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleReportSubmit = async () => {
    if (!reportSubject.trim()) return;
    try {
      await apiClient.post('/reports', {
        lessonId,
        subject: reportSubject,
        description: reportDescription,
      });
      setShowReport(false);
      setReportSubject('');
      setReportDescription('');
    } catch {
      // ignore
    }
  };

  const chatSenderName = (senderId: string) => {
    if (senderId === user?.id) return t('أنت', 'You');
    const p = participants.find((x) => x.userId === senderId);
    if (p) {
      return p.role === 'tutor' ? t('المعلم', 'Tutor') : t('طالب', 'Student');
    }
    return senderId.slice(0, 6);
  };

  const totalPages = Math.max(1, ...Object.keys(pages).map(Number), currentPage);

  if (lessonLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t('جاري تحميل الدرس...', 'Loading lesson...')}</p>
      </div>
    );
  }

  if (lessonError || !lessonId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-main)' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t('الدرس غير متاح أو انتهى', 'Lesson unavailable or ended')}</p>
        <button type="button" className="btn-primary" onClick={() => router.push('/student')}>
          {t('العودة', 'Go Back')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main)' }}>
      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-2 md:px-4 py-2 shrink-0 flex-wrap gap-2"
        style={{ background: '#0F3A40', borderBottom: '1px solid #1D535B' }}
      >
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <span className="text-xs md:text-sm font-bold" style={{ color: '#D4A353' }}>
            {lesson?.title || t('غرفة الدرس', 'Classroom')}
          </span>
          <span className="text-[10px] md:text-xs font-mono" style={{ color: '#E4CC9C' }}>
            {formatTime(elapsed)}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#1D535B' }}>
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: rtt === null ? '#6b7280' : rtt < 150 ? '#22c55e' : rtt < 500 ? '#eab308' : '#ef4444',
              }}
            />
            <span className="text-[10px] font-mono" style={{ color: '#FFFFF0' }}>
              {rtt === null ? '--' : `${rtt}ms`}
            </span>
          </div>
          {user?.role === 'tutor' && participants.length > 0 && (
            <select
              value={focusedStudent || ''}
              onChange={(e) => setFocusedStudent(e.target.value || null)}
              className="text-xs px-2 py-1 rounded-lg max-w-[120px]"
              style={{ background: '#1D535B', color: '#FFFFF0', border: '1px solid #1D535B' }}
            >
              <option value="">{t('كل الطلاب', 'All Students')}</option>
              {participants
                .filter((p) => p.role === 'student')
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
            className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs px-3 py-1.5"
            style={{ color: '#FFFFF0' }}
          >
            <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5l4.5-4.5v12L15 13.5M3 6.75A2.25 2.25 0 015.25 4.5h7.5A2.25 2.25 0 0115 6.75v10.5A2.25 2.25 0 0112.75 19.5h-7.5A2.25 2.25 0 013 17.25V6.75z" />
            </svg>
            Google Meet
          </a>
          <button
            onClick={() => setShowReport(true)}
            className="btn-ghost text-xs px-3 py-1.5"
            style={{ color: '#FFFFF0' }}
          >
            <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {t('بلّغ', 'Report')}
          </button>
          <button
            onClick={handleLeave}
            className="btn-ghost text-xs px-3 py-1.5"
            style={{ color: '#ef4444' }}
          >
            <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {t('مغادرة', 'Leave')}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Whiteboard Area */}
        <div className="flex flex-col flex-1 min-w-0 order-2 lg:order-1" style={{ background: 'var(--bg-main)' }}>
          {user?.role === 'tutor' && (
            <ClassroomBookPanel
              lessonId={lessonId}
              activeBookId={bookSession?.bookId ?? null}
              onPresent={presentBook}
              onClose={closeBookPresentation}
              isPresenting={mainView === 'book' && !!bookSession}
              t={t}
            />
          )}

          {/* View + Drawing Toolbar */}
          <div
            className="flex items-center gap-2 px-4 py-2 flex-wrap"
            style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-main)' }}>
              <button
                type="button"
                onClick={() => setMainView('whiteboard')}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: mainView === 'whiteboard' ? '#D4A353' : 'transparent',
                  color: mainView === 'whiteboard' ? '#0F3A40' : 'var(--text-muted)',
                }}
              >
                {t('السبورة', 'Whiteboard')}
              </button>
              <button
                type="button"
                onClick={() => bookSession && setMainView('book')}
                disabled={!bookSession}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
                style={{
                  background: mainView === 'book' ? '#D4A353' : 'transparent',
                  color: mainView === 'book' ? '#0F3A40' : 'var(--text-muted)',
                }}
              >
                {t('الكتاب', 'Book')}
              </button>
            </div>

            {mainView === 'whiteboard' && (
              <>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setToolColor(c); setIsEraser(false); }}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: toolColor === c && !isEraser ? '#FFFFF0' : 'transparent',
                  outline: toolColor === c && !isEraser ? '2px solid #D4A353' : 'none',
                }}
              />
            ))}
            <div className="w-px h-6" style={{ background: 'var(--border-color)' }} />
            {[2, 4, 6, 8].map((w) => (
              <button
                key={w}
                onClick={() => { setToolWidth(w); setIsEraser(false); }}
                className="rounded-full transition-transform hover:scale-110"
                style={{
                  width: 20 + w * 2,
                  height: 20 + w * 2,
                  background: toolWidth === w && !isEraser ? 'var(--primary-color)' : 'var(--text-main)',
                  opacity: toolWidth === w && !isEraser ? 1 : 0.4,
                }}
              />
            ))}
            <div className="w-px h-6" style={{ background: 'var(--border-color)' }} />
            <button
              onClick={() => setIsEraser(!isEraser)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: isEraser ? 'var(--primary-color)' : 'transparent',
                color: isEraser ? '#0F3A40' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: isEraser ? 'var(--primary-color)' : 'var(--border-color)',
              }}
            >
              {t('ممحاة', 'Eraser')}
            </button>
            <button
              onClick={handleUndo}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {t('تراجع', 'Undo')}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
              }}
            >
              {t('مسح', 'Clear')}
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <button
                onClick={() => changePage(-1)}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
              >
                ◀
              </button>
              <span className="text-xs px-2 font-medium" style={{ color: 'var(--text-main)' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => changePage(1)}
                className="px-2 py-1 rounded text-xs"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
              >
                ▶
              </button>
            </div>
              </>
            )}

            {mainView === 'book' && bookSession && (
              <>
                <div className="w-px h-6" style={{ background: 'var(--border-color)' }} />
                <span className="text-xs font-medium truncate max-w-[180px]" style={{ color: 'var(--text-main)' }}>
                  {bookSession.title}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeBookPage(-1)}
                    disabled={bookSession.page <= 1 || user?.role !== 'tutor'}
                    className="px-2 py-1 rounded text-xs disabled:opacity-30"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                  >
                    ◀
                  </button>
                  <span className="text-xs px-2 font-medium" style={{ color: 'var(--text-main)' }}>
                    {bookSession.page} / {bookSession.pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeBookPage(1)}
                    disabled={bookSession.page >= bookSession.pageCount || user?.role !== 'tutor'}
                    className="px-2 py-1 rounded text-xs disabled:opacity-30"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                  >
                    ▶
                  </button>
                </div>
                {user?.role === 'tutor' && (
                  <button
                    type="button"
                    onClick={closeBookPresentation}
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                  >
                    {t('إيقاف', 'Stop')}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Main canvas / book area */}
          <div className="flex-1 relative p-2 min-h-[320px]">
            {mainView === 'book' && bookSession ? (
              <SecureBookViewer
                lessonId={lessonId}
                bookId={bookSession.bookId}
                page={bookSession.page}
                pageCount={bookSession.pageCount}
                title={bookSession.title}
                watermark={user?.email || user?.id || 'MRH'}
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
              style={{ background: '#ffffff', touchAction: 'none' }}
            />
            )}
            {/* WebRTC Remote Video Overlay */}
            {Object.entries(remoteStreams).map(([pid, stream]) => (
              <div
                key={pid}
                className="absolute bottom-3 right-3 w-48 h-36 rounded-xl overflow-hidden shadow-xl border-2"
                style={{ borderColor: '#D4A353', zIndex: 10 }}
              >
                <video
                  ref={(el) => { if (el) el.srcObject = stream; }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {activeCall && activeCall !== 'screen' && localStreamRef.current && (
              <div className="absolute bottom-3 left-3 w-32 h-24 rounded-xl overflow-hidden shadow-lg border"
                style={{ borderColor: 'var(--border-color)', zIndex: 10 }}>
                <video
                  ref={(el) => { if (el) el.srcObject = localStreamRef.current; }}
                  muted
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* WebRTC Buttons */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ background: 'var(--bg-light)', borderTop: '1px solid var(--border-color)' }}
          >
            {!peerUser ? (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('انتظر حتى ينضم الطرف الآخر...', 'Waiting for the other participant to join...')}
              </span>
            ) : (
              <>
                <button
                  onClick={() => activeCall === 'voice' ? stopCall('voice') : startCall('voice')}
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color: activeCall === 'voice' ? '#22c55e' : 'var(--text-muted)',
                  }}
                >
                  <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {activeCall === 'voice' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    )}
                  </svg>
                  {activeCall === 'voice' ? t('إنهاء المكالمة', 'End Call') : t('مكالمة صوتية', 'Voice Call')}
                </button>
                <button
                  onClick={() => activeCall === 'camera' ? stopCall('camera') : startCall('camera')}
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color: activeCall === 'camera' ? '#22c55e' : 'var(--text-muted)',
                  }}
                >
                  <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {activeCall === 'camera' ? t('إيقاف الكاميرا', 'Stop Camera') : t('الكاميرا', 'Camera')}
                </button>
                <button
                  onClick={() => activeCall === 'screen' ? stopCall('screen') : startCall('screen')}
                  disabled={isCallLoading}
                  className="btn-ghost text-xs px-3 py-1.5"
                  style={{
                    color: activeCall === 'screen' ? '#22c55e' : 'var(--text-muted)',
                  }}
                >
                  <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                  </svg>
                  {activeCall === 'screen' ? t('إيقاف المشاركة', 'Stop Share') : t('مشاركة الشاشة', 'Screen Share')}
                </button>
              </>
            )}
            {callError && (
              <p className="text-xs w-full mt-1" style={{ color: '#ef4444' }}>
                {callError}
              </p>
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div
          className="w-full lg:w-80 flex-shrink-0 flex flex-col order-1 lg:order-2 max-h-80 lg:max-h-none"
          style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', borderLeft: 'none' }}
        >
          {/* Tab Switcher */}
          <div className="flex" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setSideTab('chat')}
              className="flex-1 py-3 text-sm font-medium text-center transition-colors"
              style={{
                color: sideTab === 'chat' ? '#D4A353' : 'var(--text-muted)',
                borderBottom: sideTab === 'chat' ? '2px solid #D4A353' : '2px solid transparent',
              }}
            >
              {t('الدردشة', 'Chat')}
            </button>
            <button
              onClick={() => setSideTab('participants')}
              className="flex-1 py-3 text-sm font-medium text-center transition-colors"
              style={{
                color: sideTab === 'participants' ? '#D4A353' : 'var(--text-muted)',
                borderBottom: sideTab === 'participants' ? '2px solid #D4A353' : '2px solid transparent',
              }}
            >
              {t('المشاركون', 'Participants')} ({participants.length})
            </button>
          </div>

          {/* Chat Panel */}
          {sideTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-center mt-8" style={{ color: 'var(--text-muted)' }}>
                    {t('لا توجد رسائل بعد', 'No messages yet')}
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {chatSenderName(msg.senderId)}
                    </span>
                    <div
                      className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                      style={{
                        background: msg.senderId === user?.id ? '#D4A353' : 'var(--bg-main)',
                        color: msg.senderId === user?.id ? '#0F3A40' : 'var(--text-main)',
                      }}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                    placeholder={t('اكتب رسالة...', 'Type a message...')}
                    className="input-field text-sm flex-1"
                  />
                  <button
                    onClick={sendChat}
                    className="btn-primary px-3 py-2"
                    style={{ background: '#D4A353', color: '#0F3A40' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M14 5l-7 7 7 7' : 'M10 19l-7-7m0 0l7-7m-7 7h18'} />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Participants Panel */}
          {sideTab === 'participants' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {participants.length === 0 && (
                <p className="text-xs text-center mt-8" style={{ color: 'var(--text-muted)' }}>
                  {t('لا يوجد مشاركون', 'No participants')}
                </p>
              )}
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-main)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(212, 163, 83,0.15)', color: '#D4A353' }}
                  >
                    {p.role === 'tutor' ? 'M' : 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>
                      {p.userId === user?.id ? t('أنت', 'You') : p.userId.slice(0, 8)}
                    </p>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: p.role === 'tutor' ? '#D4A353' : 'var(--text-muted)' }}
                    >
                      {p.role === 'tutor' ? t('معلم', 'Tutor') : t('طالب', 'Student')}
                    </span>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: (() => {
                        const r = healthMap[p.userId] ?? rtt;
                        if (r === null) return '#6b7280';
                        if (r < 150) return '#22c55e';
                        if (r < 500) return '#eab308';
                        return '#ef4444';
                      })(),
                    }}
                    title={`${healthMap[p.userId] ?? rtt ?? '?'}ms`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReport && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowReport(false)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-6 shadow-xl animate-scale-in"
            style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              {t('الإبلاغ عن مشكلة', 'Report an Issue')}
            </h3>
            <div className="space-y-3">
              <input
                value={reportSubject}
                onChange={(e) => setReportSubject(e.target.value)}
                placeholder={t('الموضوع', 'Subject')}
                className="input-field text-sm"
              />
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder={t('الوصف (اختياري)', 'Description (optional)')}
                rows={4}
                className="input-field text-sm resize-none"
              />
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowReport(false)}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={handleReportSubmit}
                  className="btn-primary text-sm px-4 py-2"
                  disabled={!reportSubject.trim()}
                >
                  {t('إرسال', 'Submit')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

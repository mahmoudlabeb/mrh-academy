'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface SecureBookViewerProps {
  lessonId: string;
  bookId: string;
  page: number;
  pageCount: number;
  title: string;
  watermark: string;
  t: (ar: string, en: string) => string;
}

export function SecureBookViewer({
  lessonId,
  bookId,
  page,
  pageCount,
  title,
  watermark,
  t,
}: SecureBookViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obscured, setObscured] = useState(false);

  const drawWatermarks = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const label = `${watermark} · MRH Academy`;
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#0F3A40';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const stepX = 220;
      const stepY = 140;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.35);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    },
    [watermark],
  );

  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.get(
        `/lessons/${lessonId}/books/${bookId}/pages/${page}`,
        { responseType: 'blob' },
      );

      const objectUrl = URL.createObjectURL(data);
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Failed to render book page'));
        image.src = objectUrl;
      });

      const container = containerRef.current;
      const maxWidth = container?.clientWidth ?? 900;
      const maxHeight = container?.clientHeight ?? 700;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1.5);
      const width = Math.floor(image.width * scale);
      const height = Math.floor(image.height * scale);

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas unavailable');
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      drawWatermarks(ctx, width, height);

      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t('تعذّر تحميل صفحة الكتاب', 'Could not load book page'));
    } finally {
      setLoading(false);
    }
  }, [bookId, drawWatermarks, lessonId, page, t]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  useEffect(() => {
    const onVisibility = () => {
      setObscured(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const blockShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const withMeta = event.ctrlKey || event.metaKey;
      if (
        key === 'printscreen' ||
        (withMeta && ['s', 'p', 'c', 'u'].includes(key))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', blockShortcuts, true);
    return () => window.removeEventListener('keydown', blockShortcuts, true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full select-none"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs"
        style={{
          background: 'rgba(15, 58, 64, 0.92)',
          color: '#FFFFF0',
          border: '1px solid rgba(212, 163, 83, 0.35)',
        }}
      >
        <span className="font-medium truncate">{title}</span>
        <span style={{ color: '#D4A353' }}>
          {page} / {pageCount}
        </span>
      </div>

      <div
        className="absolute top-14 left-3 right-3 z-20 px-3 py-1.5 rounded-lg text-[11px] text-center"
        style={{
          background: 'rgba(212, 163, 83, 0.12)',
          color: '#D4A353',
          border: '1px solid rgba(212, 163, 83, 0.25)',
        }}
      >
        {t(
          'محتوى محمي — للعرض داخل الأكاديمية فقط. التحميل ولقطات الشاشة غير مسموحين.',
          'Protected content — academy viewing only. Downloading and screenshots are not permitted.',
        )}
      </div>

      <div className="flex-1 flex items-center justify-center w-full pt-24 pb-4 px-2">
        {loading && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('جاري عرض الصفحة...', 'Rendering page...')}
          </p>
        )}
        {error && (
          <p className="text-sm text-center px-4" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
        <canvas
          ref={canvasRef}
          className="rounded-xl shadow-lg max-w-full"
          style={{
            display: loading || error ? 'none' : 'block',
            background: '#fff',
            pointerEvents: 'none',
          }}
        />
      </div>

      {obscured && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center px-6 text-center text-sm font-medium"
          style={{ background: 'rgba(15, 58, 64, 0.96)', color: '#FFFFF0' }}
        >
          {t(
            'تم إخفاء الكتاب مؤقتاً — ارجع إلى نافذة الدرس لمتابعة العرض',
            'Book hidden while away — return to this tab to continue viewing',
          )}
        </div>
      )}

      <div
        className="absolute inset-0 z-10"
        style={{ pointerEvents: 'auto' }}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden
      />
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface LessonBookMeta {
  id: string;
  title: string;
  pageCount: number;
  createdAt: string;
}

interface ClassroomBookPanelProps {
  lessonId: string;
  activeBookId: string | null;
  onPresent: (book: LessonBookMeta) => void;
  onClose: () => void;
  isPresenting: boolean;
  t: (ar: string, en: string) => string;
}

export function ClassroomBookPanel({
  lessonId,
  activeBookId,
  onPresent,
  onClose,
  isPresenting,
  t,
}: ClassroomBookPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['lesson-books', lessonId],
    queryFn: async () => {
      const { data } = await apiClient.get<LessonBookMeta[]>(
        `/lessons/${lessonId}/books`,
      );
      return data;
    },
    enabled: !!lessonId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('book', file);
      formData.append('title', file.name.replace(/\.pdf$/i, ''));
      const { data } = await apiClient.post(
        `/lessons/${lessonId}/books`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data as LessonBookMeta;
    },
    onSuccess: () => {
      setUploadError(null);
      void queryClient.invalidateQueries({ queryKey: ['lesson-books', lessonId] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        t('فشل رفع الكتاب', 'Book upload failed');
      setUploadError(String(message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bookId: string) => {
      await apiClient.delete(`/lessons/${lessonId}/books/${bookId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lesson-books', lessonId] });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError(t('يُسمح بملفات PDF فقط', 'Only PDF files are allowed'));
      return;
    }
    uploadMutation.mutate(file);
    event.target.value = '';
  };

  return (
    <div
      className="flex flex-col gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-light)' }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
            {t('كتاب الدرس', 'Lesson Book')}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t(
              'ارفع كتاب PDF واعرضه للطلاب داخل القاعة فقط',
              'Upload a PDF and present it to students inside the classroom only',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: '#D4A353', color: '#0F3A40' }}
          >
            {uploadMutation.isPending
              ? t('جاري الرفع...', 'Uploading...')
              : t('رفع كتاب', 'Upload Book')}
          </button>
          {isPresenting && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                color: '#ef4444',
                border: '1px solid #ef4444',
                background: 'transparent',
              }}
            >
              {t('إيقاف العرض', 'Stop Presenting')}
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          {uploadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('جاري تحميل الكتب...', 'Loading books...')}
        </p>
      ) : books.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('لا توجد كتب بعد — ارفع كتاب PDF للبدء', 'No books yet — upload a PDF to begin')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: 'var(--bg-main)',
                border:
                  activeBookId === book.id
                    ? '1px solid #D4A353'
                    : '1px solid var(--border-color)',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>
                  {book.title}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {book.pageCount} {t('صفحة', 'pages')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPresent(book)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0"
                style={{ background: '#1D535B', color: '#FFFFF0' }}
              >
                {activeBookId === book.id
                  ? t('يعرض الآن', 'Presenting')
                  : t('عرض', 'Present')}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(book.id)}
                disabled={deleteMutation.isPending}
                className="px-2 py-1 rounded-lg text-[11px] shrink-0"
                style={{ color: '#ef4444' }}
                title={t('حذف', 'Delete')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

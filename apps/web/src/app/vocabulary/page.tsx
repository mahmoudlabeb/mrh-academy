'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Navbar from '@/components/layout/Navbar';

interface DefinitionResult {
  word: string;
  pronunciation: string;
  definition: string;
  examples: string[];
  translation: string;
  partOfSpeech: string;
}

interface SavedWord {
  id: string;
  word: string;
  definition: string;
  examples: string | null;
  translation: string | null;
  language: string;
  contextSentence: string | null;
  savedAt: string;
}

export default function VocabularyPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();

  const [searchWord, setSearchWord] = useState('');
  const [definition, setDefinition] = useState<DefinitionResult | null>(null);
  const [contextSentence, setContextSentence] = useState('');
  const [lookupError, setLookupError] = useState('');

  const defineMutation = useMutation({
    mutationFn: async (word: string) => {
      const { data } = await apiClient.post<DefinitionResult>('/vocabulary/define', {
        word,
        language: isAr ? 'en' : 'en',
      });
      return data;
    },
    onSuccess: (data) => {
      setDefinition(data);
      setLookupError('');
    },
    onError: (err: Error) => {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setLookupError(axiosErr?.response?.data?.message || axiosErr.message || 'Failed to look up word');
      setDefinition(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!definition) return;
      await apiClient.post('/vocabulary/save', {
        word: definition.word,
        definition: definition.definition,
        examples: definition.examples?.join('\n') || '',
        translation: definition.translation,
        contextSentence: contextSentence || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list'] });
    },
  });

  const savedWordsQuery = useQuery({
    queryKey: ['vocabulary-list'],
    queryFn: async () => {
      const { data } = await apiClient.get<SavedWord[]>('/vocabulary');
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/vocabulary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const word = searchWord.trim();
    if (!word) return;
    defineMutation.mutate(word);
  };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-24 text-center">
          <p style={{ color: 'var(--text-muted)' }}>{isAr ? 'يرجى تسجيل الدخول' : 'Please log in'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
          {isAr ? 'قاموس المفردات الذكي' : 'AI Vocabulary Assistant'}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          {isAr ? 'اكتب كلمة لترى تعريفها، أمثلة، وترجمتها' : 'Type a word to see its definition, examples, and translation'}
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <input
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            placeholder={isAr ? 'اكتب كلمة...' : 'Enter a word...'}
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary" disabled={defineMutation.isPending}>
            {defineMutation.isPending
              ? (isAr ? 'جاري البحث...' : 'Searching...')
              : (isAr ? 'ابحث' : 'Search')}
          </button>
        </form>

        {lookupError && (
          <div className="card-dark p-4 mb-6 text-red-400 text-sm">{lookupError}</div>
        )}

        {definition && (
          <div className="card-dark p-6 mb-8 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#D4A353' }}>{definition.word}</h2>
                {definition.pronunciation && (
                  <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                    /{definition.pronunciation}/ {definition.partOfSpeech && `(${definition.partOfSpeech})`}
                  </p>
                )}
              </div>
              <button
                onClick={() => saveMutation.mutate()}
                className="btn-outline-gold text-xs px-3 py-1.5"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : (isAr ? 'احفظ الكلمة' : 'Save Word')}
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'التعريف' : 'Definition'}
              </p>
              <p style={{ color: 'var(--text-main)' }}>{definition.definition}</p>
            </div>

            {definition.translation && (
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'الترجمة' : 'Translation'}
                </p>
                <p style={{ color: 'var(--text-main)' }}>{definition.translation}</p>
              </div>
            )}

            {definition.examples && definition.examples.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'أمثلة' : 'Examples'}
                </p>
                <ul className="space-y-2">
                  {definition.examples.map((ex, i) => (
                    <li key={i} className="text-sm p-3 rounded-lg" style={{ background: 'var(--bg-light)', color: 'var(--text-main)' }}>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'الجملة السياقية (اختياري)' : 'Context Sentence (optional)'}
              </p>
              <input
                value={contextSentence}
                onChange={(e) => setContextSentence(e.target.value)}
                placeholder={isAr ? 'الجملة التي وجدت فيها الكلمة...' : 'The sentence where you found this word...'}
                className="input-field w-full"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
            {isAr ? 'الكلمات المحفوظة' : 'Saved Words'}
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {savedWordsQuery.data?.length || 0} {isAr ? 'كلمة' : 'words'}
          </span>
        </div>

        {savedWordsQuery.isLoading && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        )}

        {savedWordsQuery.data?.length === 0 && (
          <div className="card-dark p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'لا توجد كلمات محفوظة بعد. ابحث عن كلمة لحفظها!' : 'No saved words yet. Search for a word to save it!'}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {savedWordsQuery.data?.map((item) => (
            <div key={item.id} className="card-dark p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold" style={{ color: '#D4A353' }}>{item.word}</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {item.definition.length > 120 ? item.definition.slice(0, 120) + '...' : item.definition}
                  </p>
                  {item.contextSentence && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                      &ldquo;{item.contextSentence}&rdquo;
                    </p>
                  )}
                  {item.translation && (
                    <p className="text-xs mt-1" style={{ color: '#D4A353' }}>
                      {item.translation}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="text-xs text-red-400 hover:text-red-300 p-1"
                >
                  {isAr ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useDebounce } from '@/hooks/use-debounce';
import Link from 'next/link';

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  averageRating?: number;
  reviewCount?: number;
  user: { firstName: string; lastName: string; avatarUrl?: string };
};

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const search = searchParams.get('search') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const languages = searchParams.get('languages') || '';
  const sort = searchParams.get('sort') || 'asc';
  const nativeSpeaker = searchParams.get('nativeSpeaker') === 'true';
  const availability = searchParams.get('availability') || '';
  const category = searchParams.get('category') || '';

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (languages) params.set('languages', languages);
    if (nativeSpeaker) params.set('nativeSpeaker', 'true');
    if (availability) params.set('availability', availability);
    if (category) params.set('category', category);
    params.set('sort', sort);
    router.replace(`/student/discover?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, minPrice, maxPrice, languages, nativeSpeaker, availability, category, sort, router]);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutors', search, minPrice, maxPrice, languages, nativeSpeaker, availability, category, sort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (languages) params.set('languages', languages);
      if (nativeSpeaker) params.set('nativeSpeaker', 'true');
      if (availability) params.set('availability', availability);
      if (category) params.set('category', category);
      params.set('sort', sort);
      const { data } = await apiClient.get<TutorProfile[]>(`/tutors?${params.toString()}`);
      return data;
    },
  });

  const { data: topTutors = [] } = useQuery({
    queryKey: ['top-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>('/tutors/top');
      return data;
    },
  });

  const { data: favoriteTutors = [] } = useQuery({
    queryKey: ['favorite-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ userId: string }[]>('/students/favorite-tutors');
      return data;
    },
  });

  const favoriteIds = new Set(favoriteTutors.map((t) => t.userId));

  const favoriteMutation = useMutation({
    mutationFn: async ({ tutorId, isFavorite }: { tutorId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await apiClient.delete(`/students/favorites/${tutorId}`);
      } else {
        await apiClient.post('/students/favorites', { tutorId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-tutors'] });
    },
  });

  const toggleFavorite = (e: React.MouseEvent, tutorId: string) => {
    e.preventDefault();
    e.stopPropagation();
    favoriteMutation.mutate({ tutorId, isFavorite: favoriteIds.has(tutorId) });
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/student/discover?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#FFFFF0' }}>ابحث عن معلم</h1>
              <p className="mt-1" style={{ color: '#E4CC9C' }}>اعثر على المعلم المثالي لرحلتك التعليمية</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm" style={{ borderColor: '#1D535B', color: '#FFFFF0' }}>الرئيسية</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {topTutors.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#D4A353' }}>
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>أفضل المعلمين تقييمًا</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
              {topTutors.map((tutor) => (
                <Link
                  key={tutor.userId}
                  href={`/tutors/${tutor.userId}`}
                  className="card-gold p-5 animate-slide-up"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform hover:scale-110" style={{ background: '#D4A353' }}>
                      {tutor.user.firstName[0]}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{tutor.user.firstName} {tutor.user.lastName}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tutor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium" style={{ color: '#D4A353' }}>
                      {'★'.repeat(Math.round(tutor.averageRating || 0))}
                      {'☆'.repeat(5 - Math.round(tutor.averageRating || 0))}
                    </span>
                    <span className="font-bold" style={{ color: '#D4A353' }}>${tutor.hourlyRate}/ساعة</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0">
            <div className="card-dark p-5 space-y-6" style={{ position: 'sticky', top: '6rem' }}>
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>نطاق السعر</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="الحد الأدنى"
                    value={minPrice}
                    onChange={(e) => updateFilter('minPrice', e.target.value)}
                    className="input-field text-sm"
                  />
                  <input
                    type="number"
                    placeholder="الحد الأقصى"
                    value={maxPrice}
                    onChange={(e) => updateFilter('maxPrice', e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>اللغات</h3>
                <div className="space-y-2">
                  {['العربية', 'English', 'Français', 'Español'].map((lang) => (
                    <label key={lang} className="flex items-center gap-3 text-sm cursor-pointer group" style={{ color: 'var(--text-main)' }}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        languages.includes(lang)
                          ? 'border-[#D4A353] bg-[#D4A353]'
                          : 'border-[#1D535B]'
                      }`}>
                        {languages.includes(lang) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={languages.includes(lang)}
                        onChange={() => {
                          const current = languages ? languages.split(',') : [];
                          const next = current.includes(lang)
                            ? current.filter((l) => l !== lang)
                            : [...current, lang];
                          updateFilter('languages', next.join(','));
                        }}
                        className="sr-only"
                      />
                      {lang}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 text-sm cursor-pointer group" style={{ color: 'var(--text-main)' }}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    nativeSpeaker
                      ? 'border-[#D4A353] bg-[#D4A353]'
                      : 'border-[#1D535B]'
                  }`}>
                    {nativeSpeaker && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={nativeSpeaker}
                    onChange={(e) => updateFilter('nativeSpeaker', e.target.checked ? 'true' : '')}
                    className="sr-only"
                  />
                  المتحدثون الأصليون فقط
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>التصنيف (Category)</h3>
                <select
                  value={category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">كل التصنيفات</option>
                  <option value="business">أعمال</option>
                  <option value="kids">أطفال</option>
                  <option value="exam_prep">تحضير امتحانات</option>
                  <option value="conversation">محادثة</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>الوقت المتاح</h3>
                <select
                  value={availability}
                  onChange={(e) => updateFilter('availability', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">أي وقت</option>
                  <option value="morning">صباحاً (6-12)</option>
                  <option value="afternoon">بعد الظهر (12-17)</option>
                  <option value="evening">مساءً (17-22)</option>
                  <option value="night">ليلاً (22-6)</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>ترتيب حسب السعر</h3>
                <select
                  value={sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="asc">من الأقل إلى الأعلى</option>
                  <option value="desc">من الأعلى إلى الأقل</option>
                </select>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="relative mb-6">
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="ابحث عن معلم بالاسم أو التخصص..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input-field pr-11"
              />
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full skeleton" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 skeleton" />
                        <div className="h-3 w-24 skeleton" />
                      </div>
                    </div>
                    <div className="h-3 w-full skeleton mb-3" />
                    <div className="h-3 w-3/4 skeleton" />
                  </div>
                ))}
              </div>
            ) : tutors.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-light)' }}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <p className="font-medium" style={{ color: 'var(--text-muted)' }}>لم يتم العثور على معلمين</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>حاول تعديل عوامل التصفية أو مصطلحات البحث</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
                {tutors.map((tutor) => (
                  <Link
                    key={tutor.userId}
                    href={`/tutors/${tutor.userId}`}
                    className="card-gold p-5 relative animate-slide-up"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform hover:scale-110" style={{ background: '#D4A353' }}>
                        {tutor.user.firstName[0]}
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{tutor.user.firstName} {tutor.user.lastName}</p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tutor.specialization}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => toggleFavorite(e, tutor.userId)}
                      disabled={favoriteMutation.isPending}
                      className="absolute top-4 left-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      title={favoriteIds.has(tutor.userId) ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                    >
                      <svg
                        className={`w-5 h-5 transition-colors ${favoriteIds.has(tutor.userId) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                        fill={favoriteIds.has(tutor.userId) ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <p className="text-sm mb-4 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tutor.bio}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-1.5 flex-wrap">
                        {tutor.languages?.map((lang) => (
                          <span key={lang} className="badge" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}>{lang}</span>
                        ))}
                      </div>
                      <span className="font-bold text-lg" style={{ color: '#D4A353' }}>${tutor.hourlyRate}<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/ساعة</span></span>
                    </div>
                    {tutor.averageRating !== undefined && tutor.averageRating > 0 && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-sm" style={{ borderColor: 'var(--border-color)' }}>
                        <span style={{ color: '#D4A353' }}>{'★'.repeat(Math.round(tutor.averageRating))}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({tutor.reviewCount} تقييم)</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none" style={{ color: '#D4A353' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
        </div>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}

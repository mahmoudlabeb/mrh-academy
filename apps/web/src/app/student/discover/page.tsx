'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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

  const search = searchParams.get('search') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const languages = searchParams.get('languages') || '';
  const sort = searchParams.get('sort') || 'asc';

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (languages) params.set('languages', languages);
    params.set('sort', sort);
    router.replace(`/student/discover?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, minPrice, maxPrice, languages, sort, router]);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['tutors', search, minPrice, maxPrice, languages, sort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (languages) params.set('languages', languages);
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

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/student/discover?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Discover Tutors</h1>
              <p className="text-slate-500 mt-1">Find the perfect tutor for your learning journey</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">Home</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {topTutors.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <h2 className="text-xl font-semibold text-slate-900">Top Rated Tutors</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
              {topTutors.map((tutor) => (
                <Link
                  key={tutor.userId}
                  href={`/tutors/${tutor.userId}`}
                  className="card p-5 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      {tutor.user.firstName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{tutor.user.firstName} {tutor.user.lastName}</p>
                      <p className="text-sm text-slate-500">{tutor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-amber-500 font-medium">
                      {'★'.repeat(Math.round(tutor.averageRating || 0))}
                      {'☆'.repeat(5 - Math.round(tutor.averageRating || 0))}
                    </span>
                    <span className="font-bold text-indigo-600">${tutor.hourlyRate}/hr</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters */}
          <aside className="lg:w-64 shrink-0">
            <div className="card p-5 space-y-6 sticky top-24">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Price Range</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => updateFilter('minPrice', e.target.value)}
                    className="input-field text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => updateFilter('maxPrice', e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Languages</h3>
                <div className="space-y-2">
                  {['Arabic', 'English', 'French', 'Spanish'].map((lang) => (
                    <label key={lang} className="flex items-center gap-3 text-sm cursor-pointer group">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        languages.includes(lang)
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-slate-300 group-hover:border-indigo-300'
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
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sort by Price</h3>
                <select
                  value={sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="asc">Low to High</option>
                  <option value="desc">High to Low</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            <div className="relative mb-6">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search tutors by name, subject, or bio..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input-field pl-11"
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
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">No tutors found</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
                {tutors.map((tutor) => (
                  <Link
                    key={tutor.userId}
                    href={`/tutors/${tutor.userId}`}
                    className="card p-5 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {tutor.user.firstName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tutor.user.firstName} {tutor.user.lastName}</p>
                        <p className="text-sm text-slate-500">{tutor.specialization}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">{tutor.bio}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-1.5 flex-wrap">
                        {tutor.languages?.map((lang) => (
                          <span key={lang} className="badge bg-indigo-50 text-indigo-600 border border-indigo-100">{lang}</span>
                        ))}
                      </div>
                      <span className="font-bold text-lg text-indigo-600">${tutor.hourlyRate}<span className="text-sm font-normal text-slate-400">/hr</span></span>
                    </div>
                    {tutor.averageRating !== undefined && tutor.averageRating > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-sm">
                        <span className="text-amber-500">{'★'.repeat(Math.round(tutor.averageRating))}</span>
                        <span className="text-slate-400">({tutor.reviewCount} reviews)</span>
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  );
}

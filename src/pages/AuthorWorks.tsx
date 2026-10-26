import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Manga } from '../types';
import {
  isBookmarked,
  toggleBookmark,
  cacheMangaObjects,
  useSysLang,
  getMangaDescription,
} from '../storage';
import { NavBookmarkIcon } from '../components/Icons';
import { ArrowLeft, Star, User, Loader2 } from 'lucide-react';

export const AuthorWorks: React.FC = () => {
  const { authorId } = useParams<{ authorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sysLang] = useSysLang();

  const authorName = searchParams.get('name') || 'Creator';
  const excludeMangaId = searchParams.get('exclude') || '';

  const [works, setWorks] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!authorId) return;
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      authorId
    );
    const url = isUuid
      ? `/api/manga?authorId=${encodeURIComponent(authorId)}&limit=48`
      : `/api/manga?q=${encodeURIComponent(authorName)}&limit=48`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          cacheMangaObjects(json.data);
          const filtered = (json.data as Manga[]).filter(
            (m) => m.id !== excludeMangaId
          );
          setWorks(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authorId, authorName, excludeMangaId]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-6 pb-28 md:pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="text-center">
          <h1 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8] uppercase">
            {authorName}
          </h1>
          <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] flex items-center justify-center gap-1 mt-0.5">
            <User className="w-3.5 h-3.5 text-[#f9cb55]" />
            <span>
              {sysLang === 'id'
                ? `${works.length} Karya Lain dari Pembuat Ini`
                : `${works.length} Other Works by This Creator`}
            </span>
          </p>
        </div>

        <div className="w-8" />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-[#f9cb55] animate-spin" />
          <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
            {sysLang === 'id'
              ? `Memuat karya lain dari ${authorName}...`
              : `Loading other works by ${authorName}...`}
          </p>
        </div>
      ) : works.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-3">
          <p className="font-manga text-xl">
            {sysLang === 'id' ? 'BELUM ADA KARYA LAIN' : 'NO OTHER WORKS FOUND'}
          </p>
          <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
            {sysLang === 'id'
              ? `Tidak ditemukan manga lain dari ${authorName}.`
              : `No other manga found by ${authorName}.`}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-block px-6 py-2.5 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-sm"
          >
            {sysLang === 'id' ? 'KEMBALI' : 'GO BACK'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {works.map((manga, idx) => {
            const saved = isBookmarked(manga.id);
            const score = manga.rating
              ? Number(manga.rating).toFixed(1)
              : idx % 2 === 0
              ? '5.0'
              : '4.9';

            return (
              <div
                key={manga.id}
                className="group flex items-start gap-4 p-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] hover:border-[#f9cb55] transition-all"
              >
                <Link
                  to={`/manga/${manga.id}`}
                  state={{ manga }}
                  className="w-24 sm:w-28 aspect-[3/4] rounded-xl overflow-hidden shrink-0 bg-[#ececec] dark:bg-[#1e1e1e] shadow-md"
                >
                  <img
                    src={manga.coverUrl}
                    alt={manga.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/manga/${manga.id}`}
                      state={{ manga }}
                      className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors line-clamp-1 leading-snug"
                    >
                      {manga.title}
                    </Link>

                    <button
                      onClick={() => {
                        toggleBookmark(manga);
                        setTick((t) => t + 1);
                      }}
                      className="text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] shrink-0 p-0.5"
                    >
                      <NavBookmarkIcon active={saved} className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-[#f9cb55] font-medium mt-0.5 truncate">
                    {manga.author}
                    {manga.artist && manga.artist !== manga.author
                      ? ` • ${manga.artist}`
                      : ''}
                  </p>

                  <div className="flex items-center gap-2.5 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#121212] dark:text-[#f8f8f8]">
                      <Star className="w-3.5 h-3.5 fill-current text-[#121212] dark:text-[#f8f8f8]" />
                      {score}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-extrabold text-[10px] uppercase tracking-wider leading-none">
                      {manga.status}
                    </span>
                  </div>

                  <Link to={`/manga/${manga.id}`} state={{ manga }}>
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] line-clamp-2 mt-2 leading-relaxed">
                      {getMangaDescription(manga, sysLang)}
                    </p>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

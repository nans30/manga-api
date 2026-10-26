import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Manga, Chapter } from '../types';
import { isBookmarked, toggleBookmark, getReadChapters } from '../storage';
import { ComicStarburstButton, NavBookmarkIcon } from '../components/Icons';
import scrapedCache from '../data/mangadex-cache.json';
import {
  X,
  Menu,
  Star,
  Globe,
  ArrowUpDown,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const MangaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cache: any = scrapedCache;

  const findCachedManga = (mangaId?: string): Manga | null => {
    if (!mangaId) return null;
    const all = [...(cache.latest || []), ...(cache.popular || []), ...(cache.rating || [])];
    return all.find((m: Manga) => m.id === mangaId) || null;
  };

  const [manga, setManga] = useState<Manga | null>(() => findCachedManga(id));
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(!manga);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(() => (id ? isBookmarked(id) : false));
  const [langFilter, setLangFilter] = useState<'all' | 'id' | 'en'>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [expandedDesc, setExpandedDesc] = useState(false);

  useEffect(() => {
    if (!id) return;
    setReadIds(getReadChapters());
    setBookmarked(isBookmarked(id));

    fetch(`/api/manga/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setManga(json.data);
          setBookmarked(isBookmarked(json.data.id));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setChaptersLoading(true);

    fetch(`/api/manga/${id}/chapters?lang=${langFilter}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChapters(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setChaptersLoading(false));
  }, [id, langFilter]);

  const handleToggleBookmark = () => {
    if (!manga) return;
    const next = toggleBookmark(manga);
    setBookmarked(next);
  };

  const scrollToChapters = () => {
    const el = document.getElementById('chapters-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading && !manga) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10 space-y-6 animate-pulse">
        <div className="h-96 bg-[#ececec] dark:bg-[#1b1b1b] rounded-3xl" />
        <div className="h-48 bg-[#ececec] dark:bg-[#1b1b1b] rounded-3xl" />
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="max-w-xl mx-auto px-5 py-24 text-center space-y-4">
        <p className="font-manga text-2xl">MANGA NOT FOUND</p>
        <Link
          to="/books"
          className="inline-block px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga"
        >
          BACK TO ALL BOOKS
        </Link>
      </div>
    );
  }

  const displayedChapters = sortAsc ? [...chapters].reverse() : chapters;
  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const latestChapter = chapters.length > 0 ? chapters[0] : null;
  const targetChapter = firstChapter || latestChapter;

  const ratingScore = manga.rating ? Number(manga.rating).toFixed(1) : '5.0';
  const shortDesc =
    manga.description.length > 140 && !expandedDesc
      ? manga.description.slice(0, 140).trim() + '... '
      : manga.description;

  return (
    <div className="relative min-h-screen pb-28 md:pb-16 overflow-hidden">
      {/* Subtle Background Blur Artwork (Matches Screen 3 header backdrop) */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-96 overflow-hidden opacity-20 dark:opacity-25">
        <img
          src={manga.coverUrl}
          alt=""
          className="w-full h-full object-cover blur-2xl scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f8f8f8]/80 to-[#f8f8f8] dark:via-[#121212]/80 dark:to-[#121212]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-5 space-y-10">
        {/* Top Bar (Matches Screen 3: Close X on left, CHAPTER / Page in center, Menu ☰ on right) */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <h2 className="font-manga text-xl sm:text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8] uppercase">
              {latestChapter ? `CHAPTER ${latestChapter.chapter}` : 'MANGA PREVIEW'}
            </h2>
            <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
              {latestChapter ? `${latestChapter.pages || 32} Pages` : manga.status.toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleBookmark}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              title="Bookmark"
            >
              <NavBookmarkIcon active={bookmarked} className="w-5 h-5" />
            </button>
            <button
              onClick={scrollToChapters}
              className="p-2 -mr-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              title="Lihat Daftar Chapter"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main Screen 3 Layout (Responsive: Single column on Mobile, 2-column on Desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">
          {/* Framed Manga Artwork Card (Exact double-border frame from Screen 3) */}
          <div className="md:col-span-5 flex justify-center">
            <div className="w-full max-w-sm p-2.5 rounded-[28px] border border-[#c1c1c1]/60 dark:border-[#c1c1c1]/35 bg-[#ffffff]/50 dark:bg-[#181818]/60 shadow-2xl">
              <div className="aspect-[3/3.6] w-full rounded-[20px] overflow-hidden bg-[#ececec] dark:bg-[#1e1e1e]">
                <img
                  src={manga.coverUrlFull || manga.coverUrl}
                  alt={manga.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Right / Bottom Metadata & Starburst "READ NOW ->" Button */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-5">
            {/* Author / Japanese Alt Title Row + 5.0 TOP Badge */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm sm:text-base font-medium text-[#6e6e6e] dark:text-[#c1c1c1] truncate">
                {manga.altTitle || manga.author}
              </span>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#121212] dark:text-[#f8f8f8]">
                  <Star className="w-4 h-4 fill-current text-[#121212] dark:text-[#f8f8f8]" />
                  {ratingScore}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-extrabold text-xs uppercase tracking-wider">
                  TOP
                </span>
              </div>
            </div>

            {/* Big Stylized Manga Title ("VAST OCEAN" style) */}
            <h1 className="font-manga text-3xl sm:text-4xl md:text-5xl text-[#121212] dark:text-[#f8f8f8] tracking-wide leading-tight uppercase">
              {manga.title}
            </h1>

            {/* Genre Pills */}
            <div className="flex flex-wrap gap-2">
              {manga.tags.map((t) => (
                <Link
                  key={t.id}
                  to={`/books?tag=${t.id}`}
                  className="px-3 py-1 rounded-lg bg-[#ececec] dark:bg-[#1e1e1e] border border-[#c1c1c1]/30 dark:border-[#2b2b2b] text-xs font-medium text-[#6e6e6e] dark:text-[#c1c1c1] hover:border-[#f9cb55] hover:text-[#121212] dark:hover:text-[#f8f8f8] transition-colors"
                >
                  {t.name}
                </Link>
              ))}
            </div>

            {/* Synopsis with yellow "read more" */}
            <p className="text-xs sm:text-sm text-[#6e6e6e] dark:text-[#c1c1c1] leading-relaxed">
              {shortDesc}
              {manga.description.length > 140 && (
                <button
                  onClick={() => setExpandedDesc(!expandedDesc)}
                  className="text-[#f9cb55] font-semibold hover:underline ml-1"
                >
                  {expandedDesc ? 'show less' : 'read more'}
                </button>
              )}
            </p>

            {/* Iconic Yellow Starburst Button: READ NOW -> */}
            <div className="pt-3 flex flex-col sm:flex-row items-center gap-4">
              <ComicStarburstButton
                label="READ NOW"
                onClick={() => {
                  if (targetChapter) {
                    navigate(`/read/${targetChapter.id}?mangaId=${manga.id}&lang=${langFilter}`);
                  } else {
                    scrollToChapters();
                  }
                }}
              />

              {latestChapter && firstChapter && latestChapter.id !== firstChapter.id && (
                <Link
                  to={`/read/${latestChapter.id}?mangaId=${manga.id}&lang=${langFilter}`}
                  className="px-5 py-3 rounded-2xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] hover:border-[#f9cb55] text-xs font-bold uppercase tracking-wider text-[#121212] dark:text-[#f8f8f8] transition-all"
                >
                  Read Latest (Ch. {latestChapter.chapter})
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ==================== CHAPTERS LIST SECTION ==================== */}
        <section id="chapters-section" className="pt-8 space-y-5 border-t border-[#c1c1c1]/30 dark:border-[#262626]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-manga text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
                ALL CHAPTERS ({chapters.length})
              </h2>
              <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                Pilih chapter untuk mulai membaca (Mode Scroll atau Tap Kanan-Kiri)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Language Switcher */}
              <div className="flex items-center bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] rounded-xl p-1">
                <button
                  onClick={() => setLangFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    langFilter === 'all'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  ID + EN
                </button>
                <button
                  onClick={() => setLangFilter('id')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    langFilter === 'id'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  🇮🇩 ID
                </button>
                <button
                  onClick={() => setLangFilter('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    langFilter === 'en'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  🇬🇧 EN
                </button>
              </div>

              {/* Sort Order */}
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="px-3.5 py-2 rounded-xl bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] text-xs font-semibold text-[#121212] dark:text-[#f8f8f8] flex items-center gap-1.5 hover:border-[#f9cb55]"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#f9cb55]" />
                {sortAsc ? 'Oldest First' : 'Newest First'}
              </button>
            </div>
          </div>

          {chaptersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl bg-[#ececec] dark:bg-[#1b1b1b] animate-pulse"
                />
              ))}
            </div>
          ) : displayedChapters.length === 0 ? (
            <div className="text-center py-14 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-2">
              <p className="text-sm font-semibold">Belum ada chapter untuk bahasa ini.</p>
              {langFilter !== 'all' && (
                <button
                  onClick={() => setLangFilter('all')}
                  className="text-xs text-[#f9cb55] font-semibold underline"
                >
                  Tampilkan Semua Bahasa (ID + EN)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedChapters.map((ch) => {
                const isRead = readIds.includes(ch.id);
                return (
                  <Link
                    key={ch.id}
                    to={`/read/${ch.id}?mangaId=${manga.id}&lang=${langFilter}`}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                      isRead
                        ? 'bg-[#ececec]/50 dark:bg-[#161616] border-[#c1c1c1]/20 dark:border-[#222222] opacity-60'
                        : 'bg-[#ffffff] dark:bg-[#1b1b1b] border-[#c1c1c1]/30 dark:border-[#272727] hover:border-[#f9cb55]'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#f9cb55]/20 text-[#121212] dark:text-[#f9cb55] text-[10px] font-bold uppercase">
                          {ch.translatedLanguage === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
                        </span>
                        <span className="font-manga text-base tracking-wide text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors">
                          CHAPTER {ch.chapter}
                        </span>
                        {isRead && <CheckCircle2 className="w-4 h-4 text-[#f9cb55] shrink-0" />}
                      </div>
                      {ch.title && (
                        <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] truncate mt-1">
                          {ch.title}
                        </p>
                      )}
                      <p className="text-[11px] text-[#6e6e6e] dark:text-[#c1c1c1] mt-1">
                        {ch.groupName} • {ch.pages} Pages
                      </p>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[11px] text-[#6e6e6e] dark:text-[#c1c1c1] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(ch.publishAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="text-[11px] font-bold text-[#f9cb55] group-hover:translate-x-0.5 transition-transform">
                        READ →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Manga, MangaTag } from '../types';
import { isBookmarked, toggleBookmark } from '../storage';
import { NavBookmarkIcon } from '../components/Icons';
import scrapedCache from '../data/mangadex-cache.json';
import {
  ArrowLeft,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  User,
  Loader2,
  Globe,
} from 'lucide-react';

const cacheData: any = scrapedCache;

function getInitialCachedBooks(sortKey: string): Manga[] {
  if (sortKey === 'latest') return cacheData.latest || [];
  if (sortKey === 'rating') return cacheData.rating || [];
  return cacheData.popular || [];
}

export const AllBooks: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'popular';
  const selectedTag = searchParams.get('tag') || '';
  const authorId = searchParams.get('authorId') || '';
  const authorName = searchParams.get('authorName') || '';
  const lang = searchParams.get('lang') || ''; // '' | 'id' | 'en'
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const [books, setBooks] = useState<Manga[]>(() => getInitialCachedBooks(sort));
  const [tags, setTags] = useState<MangaTag[]>(() => (cacheData.tags || []).slice(0, 20));
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(2400);
  const [searchText, setSearchText] = useState(query);
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  const LIMIT = 24;
  const totalPages = Math.max(1, Math.min(100, Math.ceil(total / LIMIT)));

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  // Close search dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Live autocomplete with Author Name
  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/manga?q=${encodeURIComponent(q)}&limit=6`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setSuggestions(json.data);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchBooks = useCallback(async () => {
    const isDefault = !query && !selectedTag && !authorId && !lang && page === 1;
    if (isDefault) {
      const initial = getInitialCachedBooks(sort);
      if (initial.length > 0) setBooks(initial);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('sort', sort);
      if (selectedTag) params.set('tag', selectedTag);
      if (authorId) params.set('authorId', authorId);
      if (lang) params.set('lang', lang);
      params.set('limit', String(LIMIT));
      params.set('offset', String((page - 1) * LIMIT));

      const res = await fetch(`/api/manga?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setBooks(json.data);
        setTotal(json.total || json.data.length);
      }
    } catch {
      // keep cached books
    } finally {
      setLoading(false);
    }
  }, [query, sort, selectedTag, authorId, lang, page]);

  // Fetch books WITHOUT forcing window.scrollTo on every render/scroll
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length) setTags(j.data.slice(0, 24));
      })
      .catch(() => {});
  }, []);

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // Only scroll to top when user explicitly clicks a pagination button
  const goToPage = (targetPage: number) => {
    updateParam('page', String(targetPage));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    const next = new URLSearchParams(searchParams);
    if (searchText.trim()) next.set('q', searchText.trim());
    else next.delete('q');
    next.delete('authorId');
    next.delete('authorName');
    next.delete('page');
    setSearchParams(next);
  };

  const getPaginationItems = (current: number, max: number): (number | string)[] => {
    if (max <= 7) {
      return Array.from({ length: max }, (_, i) => i + 1);
    }
    const items: (number | string)[] = [];
    if (current <= 4) {
      items.push(1, 2, 3, 4, 5, '...', max);
    } else if (current >= max - 3) {
      items.push(1, '...', max - 4, max - 3, max - 2, max - 1, max);
    } else {
      items.push(1, '...', current - 1, current, current + 1, '...', max);
    }
    return items;
  };

  const pageItems = getPaginationItems(page, totalPages);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-6 pb-28 md:pb-16 space-y-6">
      {/* Top Header */}
      <div className="relative flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
          SEMUA KOMIK
        </h1>

        <div className="w-8" />
      </div>

      {/* Search Bar with Live Author Disambiguation Dropdown */}
      <div ref={searchBoxRef} className="relative">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-3 bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2a2a2a] focus-within:border-[#f9cb55] rounded-2xl px-4 py-2.5 shadow-sm"
        >
          <Search className="w-4 h-4 text-[#6e6e6e] dark:text-[#c1c1c1] shrink-0" />
          <input
            type="text"
            value={searchText}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setSearchText(e.target.value);
              setDropdownOpen(true);
            }}
            placeholder="Cari judul komik atau nama pembuat (author)..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#6e6e6e] dark:placeholder:text-[#c1c1c1] focus:outline-none"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                updateParam('q', '');
              }}
              className="text-[#c1c1c1] hover:text-[#f9cb55]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Live Search Suggestions showing Title + Author Name */}
        {dropdownOpen && searchText.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] shadow-2xl overflow-hidden z-50">
            {searching ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55]" />
                Mencari judul & pembuat...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                Tidak ada hasil untuk "{searchText}"
              </div>
            ) : (
              <div className="divide-y divide-[#c1c1c1]/20 dark:divide-[#262626] max-h-80 overflow-y-auto">
                {suggestions.map((m) => (
                  <Link
                    key={m.id}
                    to={`/manga/${m.id}${lang ? `?lang=${lang}` : ''}`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 p-3 hover:bg-[#ececec]/70 dark:hover:bg-[#242424] transition-colors"
                  >
                    <img
                      src={m.coverUrl}
                      alt={m.title}
                      className="w-10 h-14 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#121212] dark:text-[#f8f8f8] truncate">
                        {m.title}
                      </p>
                      <p className="text-xs font-medium text-[#f9cb55] flex items-center gap-1 mt-0.5 truncate">
                        <User className="w-3 h-3 shrink-0" />
                        <span>Pembuat: {m.author}</span>
                        {m.artist && m.artist !== m.author ? ` (${m.artist})` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ececec] dark:bg-[#262626] text-[#6e6e6e] dark:text-[#c1c1c1]">
                      {m.year || m.status.toUpperCase()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Author Filter Banner */}
      {authorId && (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#f9cb55]/15 border border-[#f9cb55]/50">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#121212] dark:text-[#f8f8f8]">
            <User className="w-4 h-4 text-[#f9cb55]" />
            <span>
              Menampilkan semua komik karya:{' '}
              <strong className="text-[#121212] dark:text-[#f9cb55]">
                {authorName || 'Author'}
              </strong>
            </span>
          </div>
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('authorId');
              next.delete('authorName');
              next.delete('page');
              setSearchParams(next);
            }}
            className="text-xs font-bold text-[#121212] dark:text-[#f9cb55] hover:underline flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      )}

      {/* Horizontal Genre Pills */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 -mx-5 px-5 sm:mx-0 sm:px-0">
        <button
          onClick={() => updateParam('tag', '')}
          className={`px-5 py-2.5 rounded-xl font-manga text-sm tracking-wider uppercase shrink-0 transition-all ${
            !selectedTag
              ? 'bg-[#f9cb55] text-[#121212] shadow-md shadow-[#f9cb55]/15'
              : 'bg-[#ffffff] dark:bg-[#1e1e1e] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] hover:border-[#f9cb55]'
          }`}
        >
          SEMUA
        </button>

        {tags.map((tag) => {
          const active = selectedTag === tag.id;
          return (
            <button
              key={tag.id}
              onClick={() => updateParam('tag', active ? '' : tag.id)}
              className={`px-5 py-2.5 rounded-xl font-manga text-sm tracking-wider uppercase shrink-0 transition-all ${
                active
                  ? 'bg-[#f9cb55] text-[#121212] shadow-md shadow-[#f9cb55]/15'
                  : 'bg-[#ffffff] dark:bg-[#1e1e1e] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] hover:border-[#f9cb55]'
              }`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>

      {/* Language Filter (Semua / Bahasa Indonesia / Inggris) + Count & Sort Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Language Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] rounded-xl p-1">
            <button
              type="button"
              onClick={() => updateParam('lang', '')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                lang === ''
                  ? 'bg-[#f9cb55] text-[#121212]'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Semua Bahasa
            </button>
            <button
              type="button"
              onClick={() => updateParam('lang', 'id')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                lang === 'id'
                  ? 'bg-[#f9cb55] text-[#121212]'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              🇮🇩 Bahasa Indonesia
            </button>
            <button
              type="button"
              onClick={() => updateParam('lang', 'en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                lang === 'en'
                  ? 'bg-[#f9cb55] text-[#121212]'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              🇬🇧 Inggris
            </button>
          </div>
        </div>

        {/* Count & Sort Dropdown */}
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <span className="text-xs sm:text-sm font-medium text-[#6e6e6e] dark:text-[#c1c1c1]">
            {total.toLocaleString('id-ID')} komik • Hal {page}/{totalPages}
          </span>

          <div className="relative inline-flex items-center">
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="appearance-none bg-transparent pr-6 py-1 text-xs sm:text-sm font-semibold text-[#121212] dark:text-[#f8f8f8] focus:outline-none cursor-pointer"
            >
              <option value="popular" className="bg-[#ffffff] dark:bg-[#1b1b1b]">
                Urutkan: Terpopuler
              </option>
              <option value="latest" className="bg-[#ffffff] dark:bg-[#1b1b1b]">
                Urutkan: Terbaru
              </option>
              <option value="rating" className="bg-[#ffffff] dark:bg-[#1b1b1b]">
                Urutkan: Rating Tertinggi
              </option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#121212] dark:text-[#f8f8f8] pointer-events-none absolute right-0" />
          </div>
        </div>
      </div>

      {/* Book List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div
              key={idx}
              className="h-36 rounded-2xl bg-[#ececec] dark:bg-[#1b1b1b] animate-pulse"
            />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626]">
          <p className="text-base font-semibold">Tidak ada komik yang ditemukan</p>
          <p className="text-xs text-[#c1c1c1] mt-1">Coba kata kunci atau kategori lain.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {books.map((manga, idx) => {
            const saved = isBookmarked(manga.id);
            const score = manga.rating
              ? Number(manga.rating).toFixed(1)
              : idx % 3 === 0
              ? '5.0'
              : idx % 2 === 0
              ? '4.9'
              : '4.8';
            const isTop = score === '5.0' || idx < 4;
            const detailLink = `/manga/${manga.id}${lang ? `?lang=${lang}` : ''}`;

            return (
              <div
                key={manga.id}
                className="group flex items-start gap-4 p-3 rounded-2xl bg-transparent hover:bg-[#ffffff] dark:hover:bg-[#1b1b1b] border border-transparent hover:border-[#c1c1c1]/30 dark:hover:border-[#262626] transition-all"
              >
                {/* Left Cover */}
                <Link
                  to={detailLink}
                  className="w-24 sm:w-28 aspect-[3/4] rounded-xl overflow-hidden shrink-0 bg-[#ececec] dark:bg-[#1e1e1e] shadow-md"
                >
                  <img
                    src={manga.coverUrl}
                    alt={manga.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>

                {/* Right Info */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={detailLink}
                      className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors line-clamp-1 leading-snug"
                    >
                      {manga.title}
                    </Link>

                    <button
                      onClick={() => {
                        toggleBookmark(manga);
                        setTick((t) => t + 1);
                      }}
                      className="text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] shrink-0 p-0.5 transition-transform active:scale-90"
                      title={saved ? 'Hapus dari Koleksi' : 'Simpan ke Koleksi'}
                    >
                      <NavBookmarkIcon active={saved} className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Clickable Author / Creator Name */}
                  {manga.authorId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('authorId', manga.authorId!);
                        next.set('authorName', manga.author);
                        next.delete('page');
                        setSearchParams(next);
                      }}
                      className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] dark:hover:text-[#f9cb55] mt-0.5 truncate flex items-center gap-1 transition-colors text-left"
                      title={`Lihat karya lain dari ${manga.author}`}
                    >
                      <User className="w-3 h-3 text-[#f9cb55] shrink-0" />
                      <span className="truncate underline decoration-dotted underline-offset-2">
                        {manga.author}
                      </span>
                    </button>
                  ) : (
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5 truncate flex items-center gap-1">
                      <User className="w-3 h-3 text-[#f9cb55] shrink-0" />
                      <span className="truncate">{manga.author}</span>
                    </p>
                  )}

                  {/* Rating + TOP Badge */}
                  <div className="flex items-center gap-2.5 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#121212] dark:text-[#f8f8f8]">
                      <Star className="w-3.5 h-3.5 fill-current text-[#121212] dark:text-[#f8f8f8]" />
                      {score}
                    </span>

                    {isTop && (
                      <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-extrabold text-[10px] uppercase tracking-wider leading-none">
                        TOP
                      </span>
                    )}

                    {lang === 'id' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525] text-[10px] font-bold">
                        🇮🇩 ID
                      </span>
                    )}
                  </div>

                  {/* 2-line Description */}
                  <Link to={detailLink}>
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] line-clamp-2 mt-2 leading-relaxed">
                      {manga.description}
                    </p>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== NUMBERED PAGINATION (1, 2, 3 ... 100) ==================== */}
      {!loading && books.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-8">
          <button
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="px-4 py-2.5 rounded-xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2a2a2a] text-xs font-bold uppercase tracking-wider disabled:opacity-35 hover:border-[#f9cb55] flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            PREV
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            {pageItems.map((item, index) =>
              item === '...' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-2 text-xs font-bold text-[#6e6e6e] dark:text-[#c1c1c1]"
                >
                  ...
                </span>
              ) : (
                <button
                  key={`page-${item}`}
                  onClick={() => goToPage(Number(item))}
                  className={`min-w-[38px] h-[38px] px-2.5 rounded-xl text-xs font-bold transition-all ${
                    page === item
                      ? 'bg-[#f9cb55] text-[#121212] shadow-md shadow-[#f9cb55]/20 scale-105'
                      : 'bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2a2a2a] text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55]'
                  }`}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            disabled={page >= totalPages || books.length < LIMIT}
            onClick={() => goToPage(page + 1)}
            className="px-4 py-2.5 rounded-xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2a2a2a] text-xs font-bold uppercase tracking-wider disabled:opacity-35 hover:border-[#f9cb55] flex items-center gap-1.5 transition-colors"
          >
            NEXT
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Manga, MangaTag } from '../types';
import {
  isBookmarked,
  toggleBookmark,
  cacheMangaObjects,
  useSysLang,
  getMangaDescription,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../storage';
import { POPULAR_KEYWORDS } from '../components/SearchModal';
import { NavBookmarkIcon, FlagIdIcon, FlagEnIcon } from '../components/Icons';
import scrapedCache from '../data/mangadex-cache.json';
import {
  ArrowLeft,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  User,
  Loader2,
  Globe,
  Clock,
  Sparkles,
  Filter,
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
  const [sysLang] = useSysLang();

  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const status = searchParams.get('status') || '';
  const tipe = searchParams.get('tipe') || '';
  const selectedTag = searchParams.get('tag') || '';
  const selectedTag2 = searchParams.get('tag2') || '';
  const selectedGenre = searchParams.get('genre') || '';
  const selectedGenre2 = searchParams.get('genre2') || '';
  const contentRating = searchParams.get('contentRating') || '';
  const authorId = searchParams.get('authorId') || '';
  const lang = searchParams.get('lang') || ''; // '' | 'id' | 'en'
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const [books, setBooks] = useState<Manga[]>(() => getInitialCachedBooks(sort));
  const [tags, setTags] = useState<MangaTag[]>(() => cacheData.tags || []);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(7930);
  const [searchText, setSearchText] = useState(query);
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const syncRecent = () => setRecentSearches(getRecentSearches());
    window.addEventListener('ciaran-storage-update', syncRecent);
    return () => window.removeEventListener('ciaran-storage-update', syncRecent);
  }, []);

  // Local state for the 5 filter dropdowns (Update, Status, Tipe, Genre 1, Genre 2) + Cari button
  const [draftSort, setDraftSort] = useState(sort);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftTipe, setDraftTipe] = useState(tipe);
  const [draftTag1, setDraftTag1] = useState(selectedTag || selectedGenre);
  const [draftTag2, setDraftTag2] = useState(selectedTag2 || selectedGenre2);

  useEffect(() => {
    setDraftSort(sort);
    setDraftStatus(status);
    setDraftTipe(tipe);

    const resolveInitialDropdownVal = (tagParam: string, genreParam: string) => {
      if (tagParam) return tagParam;
      if (!genreParam) return '';
      if (genreParam === 'ecchi' || genreParam === 'berwarna') return genreParam;
      const matched = tags.find(
        (t) => t.name.toLowerCase().replace(/\s+/g, '-') === genreParam.toLowerCase()
      );
      return matched ? matched.id : genreParam;
    };

    setDraftTag1(resolveInitialDropdownVal(selectedTag, selectedGenre));
    setDraftTag2(resolveInitialDropdownVal(selectedTag2, selectedGenre2));
  }, [sort, status, tipe, selectedTag, selectedGenre, selectedTag2, selectedGenre2, tags]);

  // Always scroll to top when filters, search query, or page change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [
    query,
    sort,
    status,
    tipe,
    selectedTag,
    selectedTag2,
    selectedGenre,
    selectedGenre2,
    contentRating,
    authorId,
    lang,
    page,
  ]);

  const LIMIT = 24;
  const MAX_API_PAGES = Math.floor(10000 / LIMIT); // 416 pages
  const totalPages = Math.max(1, Math.min(MAX_API_PAGES, Math.ceil(total / LIMIT)));

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/manga?q=${encodeURIComponent(q)}&limit=6${lang ? `&lang=${lang}` : ''}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data) {
            cacheMangaObjects(json.data);
            setSuggestions(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, lang]);

  const fetchBooks = useCallback(
    async (signal?: AbortSignal) => {
      const isDefault =
        !query &&
        !status &&
        !tipe &&
        !selectedTag &&
        !selectedTag2 &&
        !selectedGenre &&
        !selectedGenre2 &&
        !contentRating &&
        !authorId &&
        !lang &&
        page === 1;

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
        if (status) params.set('status', status);
        if (tipe) params.set('tipe', tipe);
        if (selectedTag) params.set('tag', selectedTag);
        if (selectedTag2) params.set('tag2', selectedTag2);
        if (selectedGenre) params.set('genre', selectedGenre);
        if (selectedGenre2) params.set('genre2', selectedGenre2);
        if (contentRating) params.set('contentRating', contentRating);
        if (authorId) params.set('authorId', authorId);
        if (lang) params.set('lang', lang);
        params.set('limit', String(LIMIT));
        const safeOffset = Math.min(10000 - LIMIT, Math.max(0, (page - 1) * LIMIT));
        params.set('offset', String(safeOffset));

        const res = await fetch(`/api/manga?${params.toString()}`, { signal });
        const json = await res.json();
        if (!signal?.aborted && json.data) {
          cacheMangaObjects(json.data);
          setBooks(json.data);
          setTotal(json.total || json.data.length);
        }
      } catch {
        // keep cached books or ignore abort
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      query,
      sort,
      status,
      tipe,
      selectedTag,
      selectedTag2,
      selectedGenre,
      selectedGenre2,
      contentRating,
      authorId,
      lang,
      page,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBooks(controller.signal);
    return () => controller.abort();
  }, [fetchBooks]);

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.length) setTags(j.data);
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

  // Resolve a selected tag ID or slug to both MangaDex UUID and Komiku genre slug
  const resolveGenreSelection = (val: string): { tagId: string; genreSlug: string } => {
    if (!val) return { tagId: '', genreSlug: '' };
    const byId = tags.find((t) => t.id === val);
    if (byId) {
      return {
        tagId: byId.id,
        genreSlug: byId.name.toLowerCase().replace(/\s+/g, '-'),
      };
    }
    const bySlug = tags.find(
      (t) => t.name.toLowerCase().replace(/\s+/g, '-') === val.toLowerCase()
    );
    if (bySlug) {
      return {
        tagId: bySlug.id,
        genreSlug: bySlug.name.toLowerCase().replace(/\s+/g, '-'),
      };
    }
    return { tagId: '', genreSlug: val.toLowerCase() };
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('sort', draftSort || 'latest');

    if (draftStatus) next.set('status', draftStatus);
    else next.delete('status');

    if (draftTipe) next.set('tipe', draftTipe);
    else next.delete('tipe');

    const g1 = resolveGenreSelection(draftTag1);
    if (g1.tagId) next.set('tag', g1.tagId);
    else next.delete('tag');
    if (g1.genreSlug) next.set('genre', g1.genreSlug);
    else next.delete('genre');

    const g2 = resolveGenreSelection(draftTag2);
    if (g2.tagId) next.set('tag2', g2.tagId);
    else next.delete('tag2');
    if (g2.genreSlug) next.set('genre2', g2.genreSlug);
    else next.delete('genre2');

    if (g1.genreSlug === 'ecchi' || g2.genreSlug === 'ecchi') {
      next.set('contentRating', 'suggestive');
    } else {
      next.delete('contentRating');
    }

    next.delete('page');
    setSearchParams(next);
  };

  const handleResetFilter = () => {
    setDraftSort('latest');
    setDraftStatus('');
    setDraftTipe('');
    setDraftTag1('');
    setDraftTag2('');
    setSearchText('');
    const next = new URLSearchParams();
    if (lang) next.set('lang', lang);
    setSearchParams(next);
  };

  const goToPage = (targetPage: number) => {
    updateParam('page', String(targetPage));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      const selected = suggestions[activeIndex];
      addRecentSearch(selected.title);
      setDropdownOpen(false);
      navigate(`/manga/${selected.id}`, { state: { manga: selected } });
      return;
    }
    setDropdownOpen(false);
    const q = searchText.trim();
    if (q) addRecentSearch(q);
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q);
    else next.delete('q');
    next.delete('authorId');
    next.delete('authorName');
    next.delete('page');
    setSearchParams(next);
  };

  const handleSelectKeyword = (kw: string) => {
    setSearchText(kw);
    addRecentSearch(kw);
    setDropdownOpen(false);
    const next = new URLSearchParams(searchParams);
    next.set('q', kw);
    next.delete('authorId');
    next.delete('authorName');
    next.delete('page');
    setSearchParams(next);
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
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
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
          {sysLang === 'id' ? 'SEMUA KOMIK' : 'ALL BOOKS'}
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
            onFocus={() => {
              setRecentSearches(getRecentSearches());
              setDropdownOpen(true);
            }}
            onKeyDown={handleKeyDownSearch}
            onChange={(e) => {
              setSearchText(e.target.value);
              setDropdownOpen(true);
            }}
            placeholder={
              sysLang === 'id'
                ? 'Cari judul komik atau nama pembuat (author)...'
                : 'Search manga title or author name...'
            }
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

        {/* Live Search Suggestions + Recent Searches Dropdown */}
        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] shadow-2xl overflow-hidden z-50">
            {searchText.trim().length >= 2 ? (
              searching ? (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55]" />
                  {sysLang === 'id' ? 'Mencari judul & pembuat...' : 'Searching title & author...'}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#6e6e6e] dark:text-[#c1c1c1] space-y-2">
                  <p>
                    {sysLang === 'id'
                      ? `Tidak ada hasil untuk "${searchText}"`
                      : `No results for "${searchText}"`}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {POPULAR_KEYWORDS.slice(0, 5).map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => handleSelectKeyword(kw)}
                        className="px-2 py-1 text-[10px] rounded-lg bg-[#ececec] dark:bg-[#252525] hover:bg-[#f9cb55] hover:text-[#121212]"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#c1c1c1]/20 dark:divide-[#262626] max-h-80 overflow-y-auto">
                  {suggestions.map((m, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <Link
                        key={m.id}
                        to={`/manga/${m.id}${lang ? `?lang=${lang}` : ''}`}
                        state={{ manga: m }}
                        onClick={() => {
                          addRecentSearch(m.title);
                          setDropdownOpen(false);
                        }}
                        className={`flex items-center gap-3 p-3 transition-colors ${
                          isActive
                            ? 'bg-[#f9cb55]/15'
                            : 'hover:bg-[#ececec]/70 dark:hover:bg-[#242424]'
                        }`}
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
                            <span>{m.author}</span>
                            {m.artist && m.artist !== m.author ? ` (${m.artist})` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ececec] dark:bg-[#262626] text-[#6e6e6e] dark:text-[#c1c1c1]">
                          {m.year || m.status.toUpperCase()}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )
            ) : (
              /* Recent Searches & Popular keywords in AllBooks search input */
              <div className="p-4 space-y-4">
                {recentSearches.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#888888]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#f9cb55]" />
                        <span>{sysLang === 'id' ? 'Pencarian Terakhir' : 'Recent Searches'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => clearRecentSearches()}
                        className="text-[#888888] hover:text-[#e57373] text-[11px]"
                      >
                        {sysLang === 'id' ? 'Hapus' : 'Clear'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.slice(0, 6).map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] text-xs font-medium text-[#121212] dark:text-[#f8f8f8]"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectKeyword(item)}
                            className="hover:text-[#f9cb55]"
                          >
                            {item}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(item);
                            }}
                            className="text-[#888888] hover:text-[#e57373]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#888888]">
                    <Sparkles className="w-3.5 h-3.5 text-[#f9cb55]" />
                    <span>{sysLang === 'id' ? 'Rekomendasi Populer' : 'Popular Suggestions'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => handleSelectKeyword(kw)}
                        className="px-3 py-1.5 rounded-xl bg-[#ececec] dark:bg-[#252525] hover:bg-[#f9cb55] hover:text-[#121212] text-xs font-medium transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== PERPUSTAKAAN KOMIK 5-DROPDOWN FILTER BAR (Photo 2 Match) ==================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/35 dark:border-[#2a2a2a] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#121212] dark:text-[#f8f8f8]">
              {sysLang === 'id' ? 'Perpustakaan Komik' : 'Comic Library'}
            </h2>
            <p className="text-xs sm:text-sm text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5">
              {sysLang === 'id' ? (
                <>
                  Jelajahi <strong className="text-[#121212] dark:text-[#f8f8f8]">{total.toLocaleString('id-ID')}</strong> judul komik dan{' '}
                  <strong className="text-[#121212] dark:text-[#f8f8f8]">422.655</strong> jumlah chapter yang tersedia{' '}
                  {lang === 'id' ? 'di Komiku Bahasa Indonesia.' : 'di Ciaran.'}
                </>
              ) : (
                <>
                  Explore <strong className="text-[#121212] dark:text-[#f8f8f8]">{total.toLocaleString('en-US')}</strong> comic titles and{' '}
                  <strong className="text-[#121212] dark:text-[#f8f8f8]">422,655</strong> chapters available.
                </>
              )}
            </p>
          </div>

          {/* Icon-Only Language Source Switcher (Globe / ID Komiku.org / EN MangaDex) */}
          <div className="inline-flex items-center gap-1 bg-[#ececec] dark:bg-[#121212] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] rounded-xl p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => updateParam('lang', '')}
              title={sysLang === 'id' ? 'Semua Bahasa' : 'All Languages'}
              className={`p-1.5 rounded-lg transition-all ${
                lang === ''
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => updateParam('lang', 'id')}
              title="Bahasa Indonesia (Komiku.org)"
              className={`p-1.5 rounded-lg transition-all ${
                lang === 'id'
                  ? 'bg-[#f9cb55] ring-2 ring-[#f9cb55]/50 shadow-sm'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <FlagIdIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => updateParam('lang', 'en')}
              title="English (MangaDex)"
              className={`p-1.5 rounded-lg transition-all ${
                lang === 'en'
                  ? 'bg-[#f9cb55] ring-2 ring-[#f9cb55]/50 shadow-sm'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <FlagEnIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 Filter Selects + Cari Button (Exact Photo 2 Layout) */}
        <form
          onSubmit={handleApplyFilter}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2.5 items-center pt-1"
        >
          {/* 1. Update / Sort */}
          <div className="lg:col-span-2">
            <select
              value={draftSort}
              onChange={(e) => setDraftSort(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f4f6] dark:bg-[#242424] border border-[#c1c1c1]/40 dark:border-[#333333] text-xs sm:text-sm font-medium text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55] cursor-pointer"
            >
              <option value="latest">Update</option>
              <option value="popular">
                {sysLang === 'id' ? 'Terpopuler' : 'Popular'}
              </option>
              <option value="rating">
                {sysLang === 'id' ? 'Rating Tertinggi' : 'Top Rated'}
              </option>
            </select>
          </div>

          {/* 2. Status */}
          <div className="lg:col-span-2">
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f4f6] dark:bg-[#242424] border border-[#c1c1c1]/40 dark:border-[#333333] text-xs sm:text-sm font-medium text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55] cursor-pointer"
            >
              <option value="">Status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">
                {sysLang === 'id' ? 'Tamat' : 'Completed'}
              </option>
              <option value="hiatus">Hiatus</option>
            </select>
          </div>

          {/* 3. Tipe (Manga / Manhwa / Manhua) */}
          <div className="lg:col-span-2">
            <select
              value={draftTipe}
              onChange={(e) => setDraftTipe(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f4f6] dark:bg-[#242424] border border-[#c1c1c1]/40 dark:border-[#333333] text-xs sm:text-sm font-medium text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55] cursor-pointer"
            >
              <option value="">{sysLang === 'id' ? 'Tipe' : 'Type'}</option>
              <option value="manga">Manga</option>
              <option value="manhwa">Manhwa</option>
              <option value="manhua">Manhua</option>
            </select>
          </div>

          {/* 4. Genre 1 */}
          <div className="lg:col-span-2">
            <select
              value={draftTag1}
              onChange={(e) => setDraftTag1(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f4f6] dark:bg-[#242424] border border-[#c1c1c1]/40 dark:border-[#333333] text-xs sm:text-sm font-medium text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55] cursor-pointer"
            >
              <option value="">Genre 1</option>
              <option value="ecchi">Ecchi</option>
              <option value="berwarna">
                {sysLang === 'id' ? 'Berwarna (Full-Color)' : 'Full-Color'}
              </option>
              {tags.map((t) => (
                <option key={`g1-${t.id}`} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Genre 2 */}
          <div className="lg:col-span-2">
            <select
              value={draftTag2}
              onChange={(e) => setDraftTag2(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f4f6] dark:bg-[#242424] border border-[#c1c1c1]/40 dark:border-[#333333] text-xs sm:text-sm font-medium text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55] cursor-pointer"
            >
              <option value="">Genre 2</option>
              <option value="ecchi">Ecchi</option>
              <option value="berwarna">
                {sysLang === 'id' ? 'Berwarna (Full-Color)' : 'Full-Color'}
              </option>
              {tags.map((t) => (
                <option key={`g2-${t.id}`} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Cari + Reset Buttons */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              {sysLang === 'id' ? 'Cari' : 'Filter'}
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="py-2.5 px-3.5 rounded-xl bg-[#ececec] dark:bg-[#2a2a2a] hover:bg-[#e0e0e0] dark:hover:bg-[#343434] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/40 dark:border-[#3a3a3a] font-semibold text-xs sm:text-sm transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Active Filters Bar */}
      {(query ||
        (sort && sort !== 'latest') ||
        status ||
        tipe ||
        selectedTag ||
        selectedGenre ||
        selectedTag2 ||
        selectedGenre2 ||
        authorId) && (
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/35 dark:border-[#2a2a2a] shadow-sm animate-in fade-in duration-150">
          <span className="text-xs font-bold text-[#888888] flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-[#f9cb55]" />
            <span>{sysLang === 'id' ? 'Filter Aktif:' : 'Active Filters:'}</span>
          </span>

          {query && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#f9cb55]/20 border border-[#f9cb55]/50 text-[#121212] dark:text-[#f9cb55] text-xs font-semibold">
              <span>{sysLang === 'id' ? `Kata Kunci: "${query}"` : `Keyword: "${query}"`}</span>
              <button
                type="button"
                onClick={() => {
                  setSearchText('');
                  updateParam('q', '');
                }}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {sort && sort !== 'latest' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>
                {sysLang === 'id'
                  ? `Urutan: ${sort === 'popular' ? 'Terpopuler' : 'Rating Tertinggi'}`
                  : `Sort: ${sort === 'popular' ? 'Popular' : 'Top Rated'}`}
              </span>
              <button
                type="button"
                onClick={() => updateParam('sort', 'latest')}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {status && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>
                {sysLang === 'id'
                  ? `Status: ${status === 'ongoing' ? 'Berjalan' : 'Tamat'}`
                  : `Status: ${status === 'ongoing' ? 'Ongoing' : 'Completed'}`}
              </span>
              <button
                type="button"
                onClick={() => updateParam('status', '')}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {tipe && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>Tipe: {tipe.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => updateParam('tipe', '')}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {(selectedTag || selectedGenre) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>
                Genre: {tags.find((t) => t.id === selectedTag)?.name || selectedGenre}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('tag');
                  next.delete('genre');
                  next.delete('contentRating');
                  setSearchParams(next);
                }}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {(selectedTag2 || selectedGenre2) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>
                Genre 2: {tags.find((t) => t.id === selectedTag2)?.name || selectedGenre2}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('tag2');
                  next.delete('genre2');
                  setSearchParams(next);
                }}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {authorId && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-xs font-medium">
              <span>Author: {searchParams.get('authorName') || 'Dipilih'}</span>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('authorId');
                  next.delete('authorName');
                  setSearchParams(next);
                }}
                className="hover:text-[#e57373]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilter}
            className="ml-auto text-xs font-bold text-[#f9cb55] hover:underline px-2 py-1 cursor-pointer"
          >
            {sysLang === 'id' ? 'Reset Semua ✕' : 'Clear All ✕'}
          </button>
        </div>
      )}

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
        <div className="text-center py-16 px-4 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#f9cb55]/15 text-[#f9cb55] flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <p className="text-lg font-bold text-[#121212] dark:text-[#f8f8f8]">
            {sysLang === 'id'
              ? 'Tidak ada komik yang sesuai dengan filter'
              : 'No manga matching your filter'}
          </p>
          <p className="text-xs text-[#888888] max-w-md mx-auto">
            {sysLang === 'id'
              ? 'Coba kurangi kombinasi filter atau gunakan kata kunci pencarian yang lebih umum.'
              : 'Try relaxing your filter combinations or using a broader search keyword.'}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleResetFilter}
              className="px-5 py-2.5 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              {sysLang === 'id' ? 'RESET SEMUA FILTER' : 'RESET ALL FILTERS'}
            </button>
          </div>
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

                {/* Right Info */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={detailLink}
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
                      className="text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] shrink-0 p-0.5 transition-transform active:scale-90"
                      title={saved ? 'Hapus dari Koleksi' : 'Simpan ke Koleksi'}
                    >
                      <NavBookmarkIcon active={saved} className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Clickable Author / Creator Name -> Navigates to Dedicated Author Page */}
                  <Link
                    to={`/author/${manga.authorId || 'search'}?name=${encodeURIComponent(
                      manga.author
                    )}&exclude=${manga.id}`}
                    className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] dark:hover:text-[#f9cb55] mt-0.5 truncate flex items-center gap-1 transition-colors"
                    title={
                      sysLang === 'id'
                        ? `Lihat semua karya ${manga.author}`
                        : `View all works by ${manga.author}`
                    }
                  >
                    <User className="w-3 h-3 text-[#f9cb55] shrink-0" />
                    <span className="truncate underline decoration-dotted underline-offset-2">
                      {manga.author}
                    </span>
                  </Link>

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
                  </div>

                  {/* 2-line Description */}
                  <Link to={detailLink} state={{ manga }}>
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

      {/* ==================== NUMBERED PAGINATION UP TO FULL LIMIT (e.g. 416) ==================== */}
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
            disabled={page >= totalPages || books.length < 10}
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

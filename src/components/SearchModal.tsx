import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Manga } from '../types';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  cacheMangaObjects,
  useSysLang,
} from '../storage';
import {
  Search,
  X,
  Clock,
  Trash2,
  Sparkles,
  User,
  Loader2,
  ArrowRight,
  BookOpen,
  CornerDownLeft,
} from 'lucide-react';

export const POPULAR_KEYWORDS = [
  'One Piece',
  'Solo Leveling',
  'Jujutsu Kaisen',
  'Chainsaw Man',
  'Naruto',
  'Bleach',
  'Manhwa',
  'Action',
  'Romance',
  'Isekai',
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const [sysLang] = useSysLang();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setRecentSearches(getRecentSearches());
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const syncRecent = () => setRecentSearches(getRecentSearches());
    window.addEventListener('ciaran-storage-update', syncRecent);
    return () => window.removeEventListener('ciaran-storage-update', syncRecent);
  }, []);

  // Live search debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/manga?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data) {
            cacheMangaObjects(json.data);
            setSuggestions(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle global escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      const selected = suggestions[activeIndex];
      addRecentSearch(selected.title);
      onClose();
      navigate(`/manga/${selected.id}`, { state: { manga: selected } });
      return;
    }

    const trimmed = query.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
      onClose();
      navigate(`/books?q=${encodeURIComponent(trimmed)}`);
    } else {
      onClose();
      navigate('/books');
    }
  };

  const handleSelectManga = (manga: Manga) => {
    addRecentSearch(manga.title);
    onClose();
    navigate(`/manga/${manga.id}`, { state: { manga } });
  };

  const handleSelectKeyword = (kw: string) => {
    setQuery(kw);
    addRecentSearch(kw);
    setTimeout(() => {
      onClose();
      navigate(`/books?q=${encodeURIComponent(kw)}`);
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setActiveIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 bg-[#0a0a0a]/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Main Search Palette Container */}
      <div className="w-full max-w-2xl bg-[#ffffff] dark:bg-[#181818] border border-[#c1c1c1]/50 dark:border-[#2a2a2a] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Top Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[#c1c1c1]/30 dark:border-[#262626] bg-[#f8f8f8] dark:bg-[#1a1a1a]"
        >
          <Search className="w-5 h-5 text-[#f9cb55] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              sysLang === 'id'
                ? 'Cari komik, pembuat, atau genre... (contoh: One Piece, Solo Leveling)'
                : 'Search manga, author, or genre... (e.g. One Piece, Solo Leveling)'
            }
            className="flex-1 bg-transparent text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#888888] focus:outline-none"
          />

          {searching && (
            <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55] shrink-0" />
          )}

          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="p-1 text-[#888888] hover:text-[#f9cb55] transition-colors rounded-lg"
              title={sysLang === 'id' ? 'Hapus teks' : 'Clear text'}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8] bg-[#ececec] dark:bg-[#252525] rounded-lg transition-colors"
          >
            ESC
          </button>
        </form>

        {/* Content Body: Suggestions or Recent + Trending Searches */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {query.trim().length >= 2 ? (
            /* ================= LIVE SEARCH RESULTS ================= */
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#c1c1c1]/20 dark:border-[#262626]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6e6e6e] dark:text-[#a0a0a0]">
                  {sysLang === 'id' ? 'Hasil Pencarian Langsung' : 'Live Search Results'}
                </span>
                <span className="text-xs text-[#f9cb55] font-semibold">
                  {suggestions.length > 0 ? `${suggestions.length} komik ditemukan` : ''}
                </span>
              </div>

              {searching && suggestions.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[#888888]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#f9cb55]" />
                  <span>
                    {sysLang === 'id'
                      ? `Mencari komik "${query}"...`
                      : `Searching manga "${query}"...`}
                  </span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#f9cb55]/15 text-[#f9cb55] flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#121212] dark:text-[#f8f8f8]">
                    {sysLang === 'id'
                      ? `Tidak ada hasil untuk "${query}"`
                      : `No results for "${query}"`}
                  </p>
                  <p className="text-xs text-[#888888] max-w-sm mx-auto">
                    {sysLang === 'id'
                      ? 'Coba periksa ejaan, gunakan kata kunci lebih umum, atau jelajahi rekomendasi di bawah:'
                      : 'Check your spelling, use more general terms, or explore trending titles below:'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {POPULAR_KEYWORDS.slice(0, 6).map((kw) => (
                      <button
                        key={kw}
                        onClick={() => handleSelectKeyword(kw)}
                        className="px-3 py-1.5 rounded-xl bg-[#ececec] dark:bg-[#222222] hover:bg-[#f9cb55] hover:text-[#121212] text-xs font-semibold text-[#6e6e6e] dark:text-[#c1c1c1] transition-all cursor-pointer"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#c1c1c1]/20 dark:divide-[#262626] mt-1">
                  {suggestions.map((m, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectManga(m)}
                        className={`flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#f9cb55]/20 dark:bg-[#f9cb55]/15 border border-[#f9cb55]/60'
                            : 'hover:bg-[#ececec]/70 dark:hover:bg-[#222222]'
                        }`}
                      >
                        <img
                          src={m.coverUrl}
                          alt={m.title}
                          className="w-12 h-16 object-cover rounded-xl shadow-md shrink-0 bg-[#222]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://placehold.co/100x140/18181b/f9cb55?text=No+Cover';
                          }}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs sm:text-sm font-bold text-[#121212] dark:text-[#f8f8f8] truncate">
                            {m.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-[#f9cb55] truncate font-medium">
                            <span className="flex items-center gap-1 shrink-0">
                              <User className="w-3 h-3" />
                              <span>{m.author || 'Komiku ID'}</span>
                            </span>
                            {m.artist && m.artist !== m.author && (
                              <span className="text-[#888888] truncate">
                                • {m.artist}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-[#888888]">
                            <span className="uppercase px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525] font-bold text-[#6e6e6e] dark:text-[#c1c1c1]">
                              {m.originalLanguage === 'ko'
                                ? 'Manhwa'
                                : m.originalLanguage === 'zh'
                                ? 'Manhua'
                                : 'Manga'}
                            </span>
                            <span>{m.status.toUpperCase()}</span>
                            {m.year && <span>• {m.year}</span>}
                            {m.lastChapter && (
                              <span className="text-[#f9cb55] font-medium">
                                • Ch. {m.lastChapter}
                              </span>
                            )}
                          </div>
                        </div>
                        <CornerDownLeft className="w-4 h-4 text-[#888888] shrink-0 opacity-40 group-hover:opacity-100" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ================= DEFAULT: RECENT SEARCHES + TRENDING ================= */
            <div className="space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6e6e6e] dark:text-[#a0a0a0]">
                      <Clock className="w-3.5 h-3.5 text-[#f9cb55]" />
                      <span>
                        {sysLang === 'id' ? 'Pencarian Terakhir' : 'Recent Searches'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => clearRecentSearches()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#888888] hover:text-[#e57373] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{sysLang === 'id' ? 'Hapus Semua' : 'Clear All'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item) => (
                      <div
                        key={item}
                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] dark:bg-[#222222] border border-[#c1c1c1]/30 dark:border-[#2b2b2b] hover:border-[#f9cb55] text-xs font-medium text-[#121212] dark:text-[#f8f8f8] transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectKeyword(item)}
                          className="hover:text-[#f9cb55] transition-colors"
                        >
                          {item}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(item);
                          }}
                          className="p-0.5 text-[#888888] hover:text-[#e57373] rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending & Popular Manga / Keywords */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6e6e6e] dark:text-[#a0a0a0]">
                    <Sparkles className="w-3.5 h-3.5 text-[#f9cb55]" />
                    <span>
                      {sysLang === 'id'
                        ? 'Populer & Rekomendasi'
                        : 'Trending & Recommendations'}
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {POPULAR_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleSelectKeyword(kw)}
                      className="px-3.5 py-2 rounded-xl bg-[#f8f8f8] dark:bg-[#202020] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] hover:bg-[#f9cb55] hover:text-[#121212] hover:border-[#f9cb55] text-xs font-semibold text-[#121212] dark:text-[#f8f8f8] transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Navigation Cards */}
              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/books?sort=popular');
                  }}
                  className="p-3 rounded-2xl bg-gradient-to-br from-[#f9cb55]/10 to-transparent border border-[#f9cb55]/30 text-left hover:border-[#f9cb55] transition-all cursor-pointer"
                >
                  <p className="font-manga text-sm text-[#f9cb55] tracking-wide">
                    {sysLang === 'id' ? 'KOMIK POPULER →' : 'POPULAR MANGA →'}
                  </p>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    {sysLang === 'id'
                      ? 'Daftar komik dengan pembaca terbanyak'
                      : 'Most read manga right now'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/books?sort=latest');
                  }}
                  className="p-3 rounded-2xl bg-gradient-to-br from-[#ececec] dark:from-[#222222] to-transparent border border-[#c1c1c1]/30 dark:border-[#2b2b2b] text-left hover:border-[#f9cb55] transition-all cursor-pointer"
                >
                  <p className="font-manga text-sm text-[#121212] dark:text-[#f8f8f8] tracking-wide">
                    {sysLang === 'id' ? 'UPDATE TERBARU →' : 'LATEST CHAPTERS →'}
                  </p>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    {sysLang === 'id'
                      ? 'Rilis chapter terkini hari ini'
                      : 'Freshly released chapters today'}
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer: See All in Catalog + Keyboard Hints */}
        <div className="px-4 sm:px-6 py-3 bg-[#f8f8f8] dark:bg-[#1a1a1a] border-t border-[#c1c1c1]/30 dark:border-[#262626] flex items-center justify-between text-xs text-[#888888]">
          <div className="hidden sm:flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-[10px] font-mono">
                ↑↓
              </kbd>{' '}
              {sysLang === 'id' ? 'pilih' : 'navigate'}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-[10px] font-mono">
                ↵
              </kbd>{' '}
              {sysLang === 'id' ? 'buka' : 'select'}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525] border border-[#c1c1c1]/40 dark:border-[#333] text-[10px] font-mono">
                ESC
              </kbd>{' '}
              {sysLang === 'id' ? 'tutup' : 'close'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-bold text-[#121212] dark:text-[#f9cb55] hover:underline"
          >
            <span>
              {query.trim()
                ? sysLang === 'id'
                  ? `Lihat semua hasil "${query}"`
                  : `See all results for "${query}"`
                : sysLang === 'id'
                ? 'Buka Semua Komik'
                : 'Browse All Books'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

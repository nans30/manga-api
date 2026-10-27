import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  NavHomeIcon,
  NavCompassIcon,
  NavBookmarkIcon,
  NavUserIcon,
  HeaderBagIcon,
  FlagIdIcon,
  FlagEnIcon,
} from './Icons';
import {
  getTheme,
  setTheme,
  ThemeMode,
  getBookmarks,
  useSysLang,
  cacheMangaObjects,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../storage';
import { Manga } from '../types';
import {
  Sun,
  Moon,
  Search,
  X,
  User,
  Loader2,
  Download,
  Clock,
  Trash2,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';
import { SearchModal, POPULAR_KEYWORDS } from './SearchModal';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [sysLang, setSysLang] = useSysLang();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const updateCounts = () => {
      setBookmarkCount(getBookmarks().length);
      setRecentSearches(getRecentSearches());
    };
    updateCounts();
    window.addEventListener('ciaran-storage-update', updateCounts);
    return () => window.removeEventListener('ciaran-storage-update', updateCounts);
  }, []);

  // Listen for global custom search event & keyboard shortcut (Ctrl+K / Cmd+K / Slash)
  useEffect(() => {
    const handleOpenSearchEvent = (e: any) => {
      setSearchOpen(true);
      if (e.detail?.query) {
        setSearchQuery(e.detail.query);
      }
    };
    window.addEventListener('ciaran-open-search', handleOpenSearchEvent);

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('ciaran-open-search', handleOpenSearchEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setActiveIndex(-1);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/manga?q=${encodeURIComponent(q)}&limit=6`)
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
  }, [searchQuery]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  const toggleSysLang = () => {
    setSysLang(sysLang === 'id' ? 'en' : 'id');
  };

  if (location.pathname.startsWith('/read/')) {
    return null;
  }

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      const sel = suggestions[activeIndex];
      addRecentSearch(sel.title);
      setDropdownOpen(false);
      navigate(`/manga/${sel.id}`, { state: { manga: sel } });
      return;
    }
    setDropdownOpen(false);
    setSearchOpen(false);
    const q = searchQuery.trim();
    if (q) {
      addRecentSearch(q);
      navigate(`/books?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/books');
    }
  };

  const handleSelectKeyword = (kw: string) => {
    setSearchQuery(kw);
    addRecentSearch(kw);
    setDropdownOpen(false);
    navigate(`/books?q=${encodeURIComponent(kw)}`);
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
      handleSearch();
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const isHome = location.pathname === '/';
  const isBooks = location.pathname.startsWith('/books');
  const isLibrary =
    location.pathname.startsWith('/library') && !location.search.includes('tab=profile');
  const isProfile =
    location.pathname.startsWith('/library') && location.search.includes('tab=profile');

  return (
    <>
      {/* Desktop Top Header */}
      <header className="hidden md:block sticky top-0 z-40 backdrop-blur-xl bg-[#f8f8f8]/90 dark:bg-[#121212]/90 border-b border-[#c1c1c1]/30 dark:border-[#262626] transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#f9cb55] flex items-center justify-center text-[#121212] font-manga text-2xl shadow-md group-hover:scale-105 transition-transform">
              C
            </div>
            <span className="font-manga text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8] leading-none">
              Ciarán
            </span>
          </Link>

          {/* Desktop Center Nav Pills */}
          <nav className="flex items-center gap-2 bg-[#ececec] dark:bg-[#1b1b1b] p-1.5 rounded-2xl border border-[#c1c1c1]/30 dark:border-[#2a2a2a]">
            <Link
              to="/"
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                isHome
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <NavHomeIcon active={isHome} className="w-4 h-4" />
              <span className="font-manga text-sm">Ciarán</span>
            </Link>

            <Link
              to="/books"
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                isBooks
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <NavCompassIcon active={isBooks} className="w-4 h-4" />
              <span className="font-manga text-sm">
                {sysLang === 'id' ? 'SEMUA KOMIK' : 'ALL BOOKS'}
              </span>
            </Link>

            <Link
              to="/library"
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                isLibrary
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <NavBookmarkIcon active={isLibrary} className="w-4 h-4" />
              <span className="font-manga text-sm">
                {sysLang === 'id' ? 'KOLEKSI' : 'SAVED'}
              </span>
            </Link>
          </nav>

          {/* Desktop Right: Search + System Language Icon + Theme Switch Icon + Bag Icon */}
          <div className="flex items-center gap-2.5">
            <div ref={searchContainerRef} className="relative w-64 lg:w-80">
              <form onSubmit={handleSearch}>
                <Search className="w-4 h-4 text-[#6e6e6e] dark:text-[#c1c1c1] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => {
                    setRecentSearches(getRecentSearches());
                    setDropdownOpen(true);
                  }}
                  onKeyDown={handleKeyDownSearch}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={
                    sysLang === 'id'
                      ? 'Cari komik atau pembuat...'
                      : 'Search manga or author...'
                  }
                  className="w-full bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] focus:border-[#f9cb55] rounded-xl pl-10 pr-16 py-2 text-xs text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#6e6e6e] dark:placeholder:text-[#c1c1c1] focus:outline-none transition-colors"
                />

                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSuggestions([]);
                        searchInputRef.current?.focus();
                      }}
                      className="p-0.5 text-[#c1c1c1] hover:text-[#f9cb55]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#888888] bg-[#e0e0e0] dark:bg-[#252525] border border-[#c1c1c1]/50 dark:border-[#333] rounded">
                      ⌘K
                    </kbd>
                  )}
                </div>
              </form>

              {/* Desktop Live Search Dropdown */}
              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 w-80 lg:w-96 -ml-8 lg:-ml-12 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                  {searchQuery.trim().length >= 2 ? (
                    /* Search results */
                    <div>
                      {searching ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                          <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55]" />
                          {sysLang === 'id' ? 'Mencari...' : 'Searching...'}
                        </div>
                      ) : suggestions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#6e6e6e] dark:text-[#c1c1c1] space-y-2">
                          <p>
                            {sysLang === 'id'
                              ? `Tidak ada hasil untuk "${searchQuery}"`
                              : `No results for "${searchQuery}"`}
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            {POPULAR_KEYWORDS.slice(0, 4).map((kw) => (
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
                        <div className="divide-y divide-[#c1c1c1]/20 dark:divide-[#262626] max-h-96 overflow-y-auto">
                          {suggestions.map((m, idx) => {
                            const isActive = idx === activeIndex;
                            return (
                              <Link
                                key={m.id}
                                to={`/manga/${m.id}`}
                                state={{ manga: m }}
                                onClick={() => {
                                  addRecentSearch(m.title);
                                  setDropdownOpen(false);
                                }}
                                className={`flex items-center gap-3 p-2.5 transition-colors ${
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
                                  <p className="text-xs font-semibold text-[#121212] dark:text-[#f8f8f8] truncate">
                                    {m.title}
                                  </p>
                                  <p className="text-[11px] font-medium text-[#f9cb55] flex items-center gap-1 mt-0.5 truncate">
                                    <User className="w-3 h-3 shrink-0" />
                                    <span>{m.author}</span>
                                    {m.artist && m.artist !== m.author ? ` • ${m.artist}` : ''}
                                  </p>
                                  <p className="text-[10px] text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5">
                                    {m.year ? `${m.year} • ` : ''}
                                    {m.status.toUpperCase()}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                          <button
                            type="button"
                            onClick={handleSearch}
                            className="w-full py-2.5 text-center text-xs font-bold text-[#121212] dark:text-[#f9cb55] bg-[#f9cb55]/15 hover:bg-[#f9cb55]/25 transition-colors cursor-pointer"
                          >
                            {sysLang === 'id'
                              ? `Lihat semua hasil "${searchQuery}" →`
                              : `See all results for "${searchQuery}" →`}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Default: Recent Searches & Trending */
                    <div className="p-3.5 space-y-4">
                      {recentSearches.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#888888]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#f9cb55]" />
                              <span>{sysLang === 'id' ? 'Pencarian Terakhir' : 'Recent Searches'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => clearRecentSearches()}
                              className="text-[#888888] hover:text-[#e57373] text-[10px]"
                            >
                              {sysLang === 'id' ? 'Hapus' : 'Clear'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {recentSearches.slice(0, 6).map((item) => (
                              <span
                                key={item}
                                className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ececec] dark:bg-[#252525] text-[11px] text-[#121212] dark:text-[#f8f8f8]"
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
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#888888]">
                          <Sparkles className="w-3 h-3 text-[#f9cb55]" />
                          <span>{sysLang === 'id' ? 'Pencarian Populer' : 'Trending'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_KEYWORDS.slice(0, 8).map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => handleSelectKeyword(kw)}
                              className="px-2.5 py-1 rounded-lg bg-[#ececec] dark:bg-[#252525] hover:bg-[#f9cb55] hover:text-[#121212] text-[11px] font-medium transition-colors"
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

            {/* PWA Install Button (surfaces automatically if browser supports install) */}
            {deferredPrompt && (
              <button
                onClick={handleInstallPwa}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] font-manga text-xs tracking-wider font-bold shadow-sm transition-all"
                title={sysLang === 'id' ? 'Install Aplikasi Ciarán' : 'Install Ciarán App'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>INSTALL APP</span>
              </button>
            )}

            {/* System Language Icon Switcher (ID <-> EN) right next to Light/Dark Mode */}
            <button
              onClick={toggleSysLang}
              className="p-2.5 rounded-xl bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] hover:border-[#f9cb55] transition-colors flex items-center justify-center"
              title={
                sysLang === 'id'
                  ? 'Bahasa Sistem: Indonesia (Klik ganti ke Inggris)'
                  : 'System Language: English (Click to switch to Indonesian)'
              }
            >
              {sysLang === 'id' ? (
                <FlagIdIcon className="w-5 h-5" />
              ) : (
                <FlagEnIcon className="w-5 h-5" />
              )}
            </button>

            {/* Light / Dark Mode Icon Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55] transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[#f9cb55]" />
              ) : (
                <Moon className="w-5 h-5 text-[#121212]" />
              )}
            </button>

            {/* Bag / Saved Library Shortcut */}
            <Link
              to="/library"
              className="relative p-2.5 rounded-xl bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55] transition-colors"
              title={sysLang === 'id' ? 'Koleksi Komik' : 'Saved Library'}
            >
              <HeaderBagIcon className="w-5 h-5" />
              {bookmarkCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f9cb55] text-[#121212] text-[10px] font-bold flex items-center justify-center">
                  {bookmarkCount > 9 ? '9+' : bookmarkCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Universal Search Modal (Mobile & Desktop Command Palette) */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchQuery}
      />

      {/* Mobile Floating Bottom Navigation Bar (5 Core Quick Actions) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f8f8f8]/95 dark:bg-[#121212]/95 backdrop-blur-xl border-t border-[#c1c1c1]/30 dark:border-[#222222] px-4 pt-2.5 pb-4 flex items-center justify-around">
        <Link
          to="/"
          className={`p-2 transition-transform active:scale-90 ${
            isHome ? 'text-[#f9cb55]' : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
          }`}
          aria-label="Home"
        >
          <NavHomeIcon active={isHome} className="w-6 h-6" />
        </Link>

        <Link
          to="/books"
          className={`p-2 transition-transform active:scale-90 ${
            isBooks ? 'text-[#f9cb55]' : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
          }`}
          aria-label="All Books"
        >
          <NavCompassIcon active={isBooks} className="w-6 h-6" />
        </Link>

        {/* Quick Search Button in Bottom Navigation */}
        <button
          onClick={() => setSearchOpen(true)}
          className="p-2.5 rounded-2xl bg-[#f9cb55] text-[#121212] shadow-lg shadow-[#f9cb55]/20 transition-transform active:scale-90 -mt-2"
          aria-label="Search"
          title={sysLang === 'id' ? 'Cari Komik' : 'Search Manga'}
        >
          <Search className="w-5 h-5 stroke-[2.5]" />
        </button>

        <Link
          to="/library"
          className={`relative p-2 transition-transform active:scale-90 ${
            isLibrary ? 'text-[#f9cb55]' : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
          }`}
          aria-label="Saved Books"
        >
          <NavBookmarkIcon active={isLibrary} className="w-6 h-6" />
          {bookmarkCount > 0 && (
            <span className="absolute 1 right-1 w-2 h-2 rounded-full bg-[#f9cb55]" />
          )}
        </Link>

        <Link
          to="/library?tab=profile"
          className={`p-2 transition-transform active:scale-90 ${
            isProfile ? 'text-[#f9cb55]' : 'text-[#6e6e6e] dark:text-[#c1c1c1]'
          }`}
          aria-label="Profile & Theme"
        >
          <NavUserIcon active={isProfile} className="w-6 h-6" />
        </Link>
      </nav>
    </>
  );
};

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
} from '../storage';
import { Manga } from '../types';
import { Sun, Moon, Search, X, User, Loader2 } from 'lucide-react';

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
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const updateCounts = () => setBookmarkCount(getBookmarks().length);
    updateCounts();
    window.addEventListener('ciaran-storage-update', updateCounts);
    return () => window.removeEventListener('ciaran-storage-update', updateCounts);
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
    }, 300);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    setSearchOpen(false);
    if (searchQuery.trim()) {
      navigate(`/books?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/books');
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
              CIARAN
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
              <span className="font-manga text-sm">NOW</span>
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
            <div ref={searchContainerRef} className="relative w-64 lg:w-72">
              <form onSubmit={handleSearch}>
                <Search className="w-4 h-4 text-[#6e6e6e] dark:text-[#c1c1c1] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={
                    sysLang === 'id'
                      ? 'Cari judul atau pembuat...'
                      : 'Search title or author...'
                  }
                  className="w-full bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] focus:border-[#f9cb55] rounded-xl pl-10 pr-8 py-2 text-xs text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#6e6e6e] dark:placeholder:text-[#c1c1c1] focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#c1c1c1] hover:text-[#f9cb55]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Live Search Suggestions with Author Name */}
              {dropdownOpen && searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] shadow-2xl overflow-hidden z-50">
                  {searching ? (
                    <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55]" />
                      {sysLang === 'id' ? 'Mencari...' : 'Searching...'}
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                      {sysLang === 'id'
                        ? `Tidak ada hasil untuk "${searchQuery}"`
                        : `No results for "${searchQuery}"`}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#c1c1c1]/20 dark:divide-[#262626] max-h-96 overflow-y-auto">
                      {suggestions.map((m) => (
                        <Link
                          key={m.id}
                          to={`/manga/${m.id}`}
                          state={{ manga: m }}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 p-2.5 hover:bg-[#ececec]/70 dark:hover:bg-[#242424] transition-colors"
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
                      ))}
                      <button
                        type="button"
                        onClick={handleSearch}
                        className="w-full py-2.5 text-center text-xs font-bold text-[#121212] dark:text-[#f9cb55] bg-[#f9cb55]/15 hover:bg-[#f9cb55]/25 transition-colors"
                      >
                        {sysLang === 'id'
                          ? `Lihat semua hasil "${searchQuery}" →`
                          : `See all results for "${searchQuery}" →`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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

      {/* Mobile Search Modal */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#121212]/80 backdrop-blur-md flex flex-col p-4">
          <form
            onSubmit={handleSearch}
            className="bg-[#f8f8f8] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2b2b2b] rounded-2xl p-3 flex items-center gap-3 shadow-2xl"
          >
            <Search className="w-5 h-5 text-[#f9cb55] shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                sysLang === 'id'
                  ? 'Cari judul komik atau pembuat...'
                  : 'Search manga or author...'
              }
              className="flex-1 bg-transparent text-sm text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#c1c1c1] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-1.5 rounded-lg text-[#c1c1c1]"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Floating Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f8f8f8]/95 dark:bg-[#121212]/95 backdrop-blur-xl border-t border-[#c1c1c1]/30 dark:border-[#222222] px-6 pt-3 pb-5 flex items-center justify-between">
        <Link
          to="/"
          className="p-2 text-[#6e6e6e] dark:text-[#c1c1c1] transition-transform active:scale-90"
          aria-label="Home"
        >
          <NavHomeIcon active={isHome} className="w-6 h-6" />
        </Link>

        <Link
          to="/books"
          className="p-2 text-[#6e6e6e] dark:text-[#c1c1c1] transition-transform active:scale-90"
          aria-label="All Books"
        >
          <NavCompassIcon active={isBooks} className="w-6 h-6" />
        </Link>

        <Link
          to="/library"
          className="p-2 text-[#6e6e6e] dark:text-[#c1c1c1] transition-transform active:scale-90"
          aria-label="Saved Books"
        >
          <NavBookmarkIcon active={isLibrary} className="w-6 h-6" />
        </Link>

        <Link
          to="/library?tab=profile"
          className="p-2 text-[#6e6e6e] dark:text-[#c1c1c1] transition-transform active:scale-90"
          aria-label="Profile & Theme"
        >
          <NavUserIcon active={isProfile} className="w-6 h-6" />
        </Link>
      </nav>
    </>
  );
};

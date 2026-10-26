import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  NavHomeIcon,
  NavCompassIcon,
  NavBookmarkIcon,
  NavUserIcon,
  HeaderBagIcon,
} from './Icons';
import { getTheme, setTheme, ThemeMode, getBookmarks } from '../storage';
import { Sun, Moon, Search, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const updateCounts = () => setBookmarkCount(getBookmarks().length);
    updateCounts();
    window.addEventListener('ciaran-storage-update', updateCounts);
    return () => window.removeEventListener('ciaran-storage-update', updateCounts);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  // Hide global navbar inside chapter reader view (Reader has its own exact top/bottom HUD)
  if (location.pathname.startsWith('/read/')) {
    return null;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/books?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
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
      {/* Desktop Top Header (Visible on md+ screens, matches reference aesthetic) */}
      <header className="hidden md:block sticky top-0 z-40 backdrop-blur-xl bg-[#f8f8f8]/90 dark:bg-[#121212]/90 border-b border-[#c1c1c1]/30 dark:border-[#262626] transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#f9cb55] flex items-center justify-center text-[#121212] font-manga text-2xl shadow-md group-hover:scale-105 transition-transform">
              C
            </div>
            <div className="flex flex-col">
              <span className="font-manga text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8] leading-none">
                CIARAN
              </span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5">
                MangaDex Reader
              </span>
            </div>
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
              <span className="font-manga text-sm">ALL BOOKS</span>
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
              <span className="font-manga text-sm">SAVED</span>
            </Link>
          </nav>

          {/* Desktop Right Search + Theme + Bag */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative w-64 lg:w-72">
              <Search className="w-4 h-4 text-[#6e6e6e] dark:text-[#c1c1c1] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search manga, author..."
                className="w-full bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] focus:border-[#f9cb55] rounded-xl pl-10 pr-8 py-2 text-xs text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#6e6e6e] dark:placeholder:text-[#c1c1c1] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#c1c1c1] hover:text-[#f9cb55]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Light / Dark Mode Button */}
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
              title="Koleksi Komik"
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

      {/* Mobile Search Modal when triggered from NOW header */}
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
              placeholder="Cari judul komik..."
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

      {/* Mobile Floating Bottom Navigation Bar (Matches Reference Image 100%) */}
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

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Home, Compass, Bookmark, Search, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Hide navigation bar inside fullscreen reader mode if needed, or keep compact
  const isReader = location.pathname.startsWith('/read/');
  if (isReader) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-zinc-950/85 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-zinc-100 to-orange-400 bg-clip-text text-transparent">
                CIARAN
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                MangaDex Live
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                location.pathname === '/' && !location.search.includes('sort=popular')
                  ? 'bg-zinc-800/90 text-orange-400'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Home className="w-4 h-4" />
              Beranda & Update
            </Link>
            <Link
              to="/?sort=popular"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                location.search.includes('sort=popular')
                  ? 'bg-zinc-800/90 text-orange-400'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Compass className="w-4 h-4" />
              Populer
            </Link>
            <Link
              to="/library"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                location.pathname === '/library'
                  ? 'bg-zinc-800/90 text-orange-400'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Koleksi & Riwayat
            </Link>
          </nav>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearch} className="hidden sm:flex items-center flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul manga, manhwa, manhua..."
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-orange-500 rounded-xl pl-10 pr-9 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  navigate('/');
                }}
                className="absolute right-2.5 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Mobile Search Toggle */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="sm:hidden p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-orange-400"
            aria-label="Cari Manga"
          >
            {mobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Search Drawer */}
        {mobileSearchOpen && (
          <form onSubmit={handleSearch} className="sm:hidden px-4 pb-3 bg-zinc-950 border-b border-zinc-800">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari komik di MangaDex..."
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-orange-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100"
              />
            </div>
          </form>
        )}
      </header>

      {/* Bottom Floating Navigation for Mobile (HP) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-6 py-2 flex items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
            location.pathname === '/' && !location.search.includes('sort=popular')
              ? 'text-orange-400'
              : 'text-zinc-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Update</span>
        </Link>
        <Link
          to="/?sort=popular"
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
            location.search.includes('sort=popular') ? 'text-orange-400' : 'text-zinc-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>Populer</span>
        </Link>
        <Link
          to="/library"
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
            location.pathname === '/library' ? 'text-orange-400' : 'text-zinc-400'
          }`}
        >
          <Bookmark className="w-5 h-5" />
          <span>Koleksi</span>
        </Link>
      </nav>
    </>
  );
};

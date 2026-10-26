import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Manga, ReadingHistoryItem } from '../types';
import { getReadingHistory, getTheme, setTheme, ThemeMode, getBookmarks } from '../storage';
import { HeaderBagIcon } from '../components/Icons';
import scrapedCache from '../data/mangadex-cache.json';
import { Search, Sun, Moon, ArrowRight, RefreshCw, Star, X } from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const cache: any = scrapedCache;

  const [latestManga, setLatestManga] = useState<Manga[]>(() => cache.latest || []);
  const [popularManga, setPopularManga] = useState<Manga[]>(() => cache.popular || []);
  const [history, setHistory] = useState<ReadingHistoryItem[]>(() => getReadingHistory());
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [bookmarkCount, setBookmarkCount] = useState(() => getBookmarks().length);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  const fetchLiveHomeData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [latestRes, popRes] = await Promise.all([
        fetch('/api/manga?sort=latest&limit=18').then((r) => r.json()),
        fetch('/api/manga?sort=popular&limit=12').then((r) => r.json()),
      ]);
      if (latestRes.data?.length) setLatestManga(latestRes.data);
      if (popRes.data?.length) setPopularManga(popRes.data);
    } catch {
      // fallback to scraped cache seamlessly
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveHomeData();
    const syncStorage = () => {
      setHistory(getReadingHistory());
      setBookmarkCount(getBookmarks().length);
    };
    window.addEventListener('ciaran-storage-update', syncStorage);
    // Auto refresh every 60 seconds
    const timer = setInterval(fetchLiveHomeData, 60000);
    return () => {
      window.removeEventListener('ciaran-storage-update', syncStorage);
      clearInterval(timer);
    };
  }, [fetchLiveHomeData]);

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/books?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  // Determine the "NOW" card data (either latest read history or #1 popular manga)
  const lastRead = history[0];
  const fallbackHero = popularManga[0] || latestManga[0];

  const nowItem = lastRead
    ? {
        id: lastRead.mangaId,
        title: lastRead.mangaTitle,
        chapterText: `Chapter ${lastRead.chapterNumber}`,
        author: lastRead.author || 'MangaDex Creator',
        coverUrl: lastRead.coverUrl,
        progress: lastRead.progressPercent || 78,
        timeLeft: '20 min left',
        link: `/read/${lastRead.chapterId}?mangaId=${lastRead.mangaId}&lang=${lastRead.language}`,
      }
    : fallbackHero
    ? {
        id: fallbackHero.id,
        title: fallbackHero.title,
        chapterText: fallbackHero.lastChapter
          ? `Chapter ${fallbackHero.lastChapter}`
          : 'Chapter 1',
        author: fallbackHero.author,
        coverUrl: fallbackHero.coverUrl,
        progress: 78,
        timeLeft: '20 min left',
        link: `/manga/${fallbackHero.id}`,
      }
    : null;

  const forYouList = popularManga.slice(1, 9);
  const allBooksPreview = latestManga.slice(0, 12);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-6 pb-28 md:pb-16 space-y-10">
      {/* ==================== SECTION 1: NOW ==================== */}
      <section className="space-y-5">
        {/* Top Row: NOW + Icons (Mobile & Desktop) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-manga text-3xl sm:text-4xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
              NOW
            </h1>
            <button
              onClick={fetchLiveHomeData}
              disabled={refreshing}
              className="p-1.5 rounded-full text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] transition-colors"
              title="Sinkronisasi Real-Time MangaDex"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#f9cb55]' : ''}`} />
            </button>
          </div>

          {/* Mobile Top Action Icons (Search, Light/Dark, Bag) matching Screen 1 */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 stroke-[2]" />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              aria-label="Toggle Light/Dark Mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[#f9cb55]" />
              ) : (
                <Moon className="w-5 h-5 text-[#121212]" />
              )}
            </button>

            <Link
              to="/library"
              className="relative p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              aria-label="Saved Books"
            >
              <HeaderBagIcon className="w-5 h-5" />
              {bookmarkCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#f9cb55]" />
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar Expandable */}
        {mobileSearchOpen && (
          <form
            onSubmit={handleMobileSearch}
            className="md:hidden flex items-center gap-2 bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] rounded-2xl px-4 py-2.5 shadow-lg"
          >
            <Search className="w-4 h-4 text-[#f9cb55]" />
            <input
              type="text"
              autoFocus
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari komik di MangaDex..."
              className="flex-1 bg-transparent text-sm text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#c1c1c1] focus:outline-none"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')}>
                <X className="w-4 h-4 text-[#c1c1c1]" />
              </button>
            )}
          </form>
        )}

        {/* NOW Main Card + Desktop Secondary Card */}
        {nowItem && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Primary NOW Card (Matches Solo Leveling Vol. 5 layout in Reference Image 1) */}
            <div className="lg:col-span-7 flex flex-row items-center gap-5 sm:gap-7 bg-[#ffffff] dark:bg-[#181818] border border-[#c1c1c1]/30 dark:border-[#262626] rounded-3xl p-4 sm:p-6 shadow-xl">
              <Link
                to={`/manga/${nowItem.id}`}
                className="w-32 sm:w-44 aspect-[3/4.2] rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-[#c1c1c1]/20 dark:border-[#2b2b2b] group"
              >
                <img
                  src={nowItem.coverUrl}
                  alt={nowItem.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </Link>

              <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-3.5">
                <div>
                  <Link
                    to={`/manga/${nowItem.id}`}
                    className="font-semibold text-base sm:text-xl text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors line-clamp-2 leading-snug"
                  >
                    {nowItem.title}
                  </Link>
                  <p className="text-xs sm:text-sm font-medium text-[#121212]/80 dark:text-[#f8f8f8]/90 mt-1">
                    {nowItem.chapterText}
                  </p>
                  <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-1 truncate">
                    {nowItem.author}
                  </p>
                </div>

                {/* Progress Bar: "78% • 20 min left" */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="text-[#f9cb55] font-semibold">{nowItem.progress}%</span>
                    <span className="text-[#c1c1c1]">•</span>
                    <span className="text-[#121212] dark:text-[#f8f8f8]">{nowItem.timeLeft}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#e2e2e2] dark:bg-[#2a2a2a] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#f9cb55] transition-all duration-500"
                      style={{ width: `${nowItem.progress}%` }}
                    />
                  </div>
                </div>

                {/* Tilted Golden Button: CONTINUE READING */}
                <div className="pt-2">
                  <Link
                    to={nowItem.link}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-sm sm:text-base tracking-wider shadow-lg shadow-[#f9cb55]/20 -rotate-1 hover:rotate-0 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    CONTINUE READING
                  </Link>
                </div>
              </div>
            </div>

            {/* Desktop Spotlight Card (Visible on Large Screens) */}
            {popularManga[1] && (
              <Link
                to={`/manga/${popularManga[1].id}`}
                className="hidden lg:flex lg:col-span-5 relative rounded-3xl overflow-hidden border border-[#c1c1c1]/30 dark:border-[#262626] bg-[#1b1b1b] p-6 flex-col justify-end group shadow-xl"
              >
                <img
                  src={popularManga[1].coverUrl}
                  alt={popularManga[1].title}
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/70 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-bold text-[10px] uppercase tracking-wider">
                      TOP TRENDING
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#f8f8f8]">
                      <Star className="w-3.5 h-3.5 fill-[#f9cb55] text-[#f9cb55]" />
                      4.9
                    </span>
                  </div>
                  <h3 className="font-manga text-2xl text-[#f8f8f8] line-clamp-1">
                    {popularManga[1].title}
                  </h3>
                  <p className="text-xs text-[#c1c1c1] line-clamp-2">
                    {popularManga[1].description}
                  </p>
                </div>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ==================== SECTION 2: FOR YOU ==================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
            FOR YOU
          </h2>
          <Link
            to="/books?sort=popular"
            className="p-1.5 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
            aria-label="See all recommended"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Horizontal Carousel of Wide Cards (Matches "Ranked Adventurer" in Screen 1) */}
        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 sm:mx-0 sm:px-0">
          {forYouList.map((manga) => (
            <Link
              key={manga.id}
              to={`/manga/${manga.id}`}
              className="group shrink-0 w-64 sm:w-80 flex flex-col gap-2.5"
            >
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] shadow-md">
                <img
                  src={manga.coverUrl}
                  alt={manga.title}
                  loading="lazy"
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/70 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#f9cb55] text-[#121212] font-bold text-[10px] uppercase tracking-wider">
                  {manga.originalLanguage === 'ko'
                    ? 'MANHWA'
                    : manga.originalLanguage === 'zh'
                    ? 'MANHUA'
                    : 'MANGA'}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors truncate">
                  {manga.title}
                </h3>
                <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5">
                  {manga.lastChapter ? `Chapter ${manga.lastChapter}` : manga.author}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ==================== SECTION 3: ALL BOOKS ==================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
            ALL BOOKS
          </h2>
          <Link
            to="/books"
            className="p-1.5 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <span className="hidden sm:inline">Explore Catalog</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Grid of Cards (2 columns on mobile like Screen 1 bottom, 4-6 columns on Desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {allBooksPreview.map((manga) => (
            <Link
              key={manga.id}
              to={`/manga/${manga.id}`}
              className="group flex flex-col gap-2"
            >
              <div className="relative aspect-[3/3.8] w-full rounded-2xl overflow-hidden bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] shadow-md">
                <img
                  src={manga.coverUrl}
                  alt={manga.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/80 via-transparent to-transparent opacity-80" />
                {manga.lastChapter && (
                  <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#121212]/85 text-[#f9cb55] text-[10px] font-bold backdrop-blur-sm">
                    Ch. {manga.lastChapter}
                  </span>
                )}
              </div>
              <div className="px-0.5">
                <h3 className="font-semibold text-xs sm:text-sm text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors line-clamp-1">
                  {manga.title}
                </h3>
                <p className="text-[11px] text-[#6e6e6e] dark:text-[#c1c1c1] truncate">
                  {manga.author}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            to="/books"
            className="px-8 py-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] hover:border-[#f9cb55] text-xs font-bold uppercase tracking-widest text-[#121212] dark:text-[#f8f8f8] transition-all shadow-sm"
          >
            BROWSE ALL BOOKS →
          </Link>
        </div>
      </section>
    </div>
  );
};

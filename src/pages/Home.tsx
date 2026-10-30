import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Manga, ReadingHistoryItem } from '../types';
import {
  getReadingHistory,
  getTheme,
  setTheme,
  ThemeMode,
  getBookmarks,
  cacheMangaObjects,
  useSysLang,
  getMangaDescription,
} from '../storage';
import { HeaderBagIcon, FlagIdIcon, FlagEnIcon } from '../components/Icons';
import scrapedCache from '../data/mangadex-cache.json';
import {
  Search,
  Sun,
  Moon,
  ArrowRight,
  RefreshCw,
  Star,
  X,
  Globe,
  Clock,
  BookOpen,
} from 'lucide-react';
import { formatRelativeTime } from '../components/MangaCard';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const cache: any = scrapedCache;
  const [sysLang, setSysLang] = useSysLang();

  const [latestManga, setLatestManga] = useState<Manga[]>(() => cache.latest || []);
  const [popularManga, setPopularManga] = useState<Manga[]>(() => cache.popular || []);
  const [homeLang, setHomeLang] = useState<'' | 'id' | 'en'>('');
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

  const toggleSysLang = () => {
    setSysLang(sysLang === 'id' ? 'en' : 'id');
  };

  const fetchLiveHomeData = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      try {
        const langParam = homeLang ? `&lang=${homeLang}` : '';
        const [latestRes, popRes] = await Promise.all([
          fetch(`/api/manga?sort=latest&limit=18${langParam}`, { signal }).then((r) =>
            r.json()
          ),
          fetch(`/api/manga?sort=popular&limit=12${langParam}`, { signal }).then((r) =>
            r.json()
          ),
        ]);
        if (!signal?.aborted) {
          if (latestRes.data?.length) {
            cacheMangaObjects(latestRes.data);
            setLatestManga(latestRes.data);
          }
          if (popRes.data?.length) {
            cacheMangaObjects(popRes.data);
            setPopularManga(popRes.data);
          }
        }
      } catch {
        // fallback to scraped cache seamlessly
      } finally {
        if (!signal?.aborted) {
          setRefreshing(false);
        }
      }
    },
    [homeLang]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveHomeData(controller.signal);
    const syncStorage = () => {
      setHistory(getReadingHistory());
      setBookmarkCount(getBookmarks().length);
    };
    window.addEventListener('ciaran-storage-update', syncStorage);
    const timer = setInterval(() => fetchLiveHomeData(), 60000);
    return () => {
      controller.abort();
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

  const lastRead = history[0];
  const fallbackHero = popularManga[0] || latestManga[0];

  const nowItem = lastRead
    ? {
        id: lastRead.mangaId,
        title: lastRead.mangaTitle,
        chapterText: `Chapter ${lastRead.chapterNumber}`,
        author: lastRead.author || 'Unknown Author',
        coverUrl: lastRead.coverUrl,
        progress: lastRead.progressPercent || 78,
        timeLeft: sysLang === 'id' ? '20 mnt tersisa' : '20 min left',
        link: `/read/${lastRead.chapterId}?mangaId=${lastRead.mangaId}&lang=${lastRead.language}`,
        mangaObj: undefined as Manga | undefined,
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
        timeLeft: sysLang === 'id' ? '20 mnt tersisa' : '20 min left',
        link: `/manga/${fallbackHero.id}`,
        mangaObj: fallbackHero,
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
            <div className="md:hidden w-9 h-9 rounded-xl bg-[#f9cb55] flex items-center justify-center text-[#121212] font-manga text-xl shadow-md shrink-0">
              C
            </div>
            <h1 className="font-manga text-3xl sm:text-4xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
              Ciarán
            </h1>
            <button
              onClick={() => fetchLiveHomeData()}
              disabled={refreshing}
              className="p-1.5 rounded-full text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#f9cb55] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#f9cb55]' : ''}`} />
            </button>
          </div>

          {/* Mobile Top Action Icons (Search, System Language Flag Icon, Light/Dark, Bag) */}
          <div className="flex md:hidden items-center gap-2.5">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('ciaran-open-search', { detail: { query: '' } })
                );
              }}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 stroke-[2]" />
            </button>

            {/* System Language Icon (ID / EN) right next to Light/Dark Mode */}
            <button
              onClick={toggleSysLang}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              aria-label="Toggle System Language"
            >
              {sysLang === 'id' ? (
                <FlagIdIcon className="w-5 h-5" />
              ) : (
                <FlagEnIcon className="w-5 h-5" />
              )}
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

        {/* NOW Main Card + Desktop Secondary Card */}
        {nowItem && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 flex flex-row items-center gap-5 sm:gap-7 bg-[#ffffff] dark:bg-[#181818] border border-[#c1c1c1]/30 dark:border-[#262626] rounded-3xl p-4 sm:p-6 shadow-xl">
              <Link
                to={`/manga/${nowItem.id}`}
                state={nowItem.mangaObj ? { manga: nowItem.mangaObj } : undefined}
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
                    state={nowItem.mangaObj ? { manga: nowItem.mangaObj } : undefined}
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

                {/* Progress Bar */}
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

                {/* Tilted Golden Button */}
                <div className="pt-2">
                  <Link
                    to={nowItem.link}
                    state={nowItem.mangaObj ? { manga: nowItem.mangaObj } : undefined}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-sm sm:text-base tracking-wider shadow-lg shadow-[#f9cb55]/20 -rotate-1 hover:rotate-0 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {sysLang === 'id' ? 'LANJUT BACA' : 'CONTINUE READING'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Desktop Spotlight Card */}
            {popularManga[1] && (
              <Link
                to={`/manga/${popularManga[1].id}`}
                state={{ manga: popularManga[1] }}
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
                    {getMangaDescription(popularManga[1], sysLang)}
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
            {sysLang === 'id' ? 'UNTUK KAMU' : 'FOR YOU'}
          </h2>
          <Link
            to="/books?sort=popular"
            className="p-1.5 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
            aria-label="See all recommended"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 sm:mx-0 sm:px-0">
          {forYouList.map((manga) => (
            <Link
              key={manga.id}
              to={`/manga/${manga.id}`}
              state={{ manga }}
              className="group shrink-0 w-64 sm:w-80 flex flex-col gap-2.5"
            >
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] shadow-md">
                <img
                  src={manga.coverUrl}
                  alt={manga.title}
                  loading="lazy"
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/75 via-transparent to-transparent" />
                
                {/* Source Badge */}
                {manga.id.startsWith('komikindo:') || manga.source === 'komikindo' ? (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-purple-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow">
                    Komikindo
                  </span>
                ) : manga.id.startsWith('komiku:') || manga.source === 'komiku' ? (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow">
                    Komiku
                  </span>
                ) : null}

                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#f9cb55] text-[#121212] font-bold text-[10px] uppercase tracking-wider">
                  {manga.originalLanguage === 'ko'
                    ? 'MANHWA'
                    : manga.originalLanguage === 'zh'
                    ? 'MANHUA'
                    : 'MANGA'}
                </span>

                {/* Bottom Overlay Info (Komiku Style) */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-zinc-200 font-semibold">
                  {manga.lastChapter ? (
                    <span className="px-2 py-0.5 rounded-md bg-[#121212]/85 text-[#f9cb55] flex items-center gap-1 backdrop-blur-sm border border-[#f9cb55]/30">
                      <BookOpen className="w-3 h-3" />
                      Ch. {manga.lastChapter}
                    </span>
                  ) : null}
                  {manga.updatedAt && (
                    <span className="text-[11px] text-zinc-300 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#121212]/80 backdrop-blur-sm">
                      <Clock className="w-3 h-3 text-[#f9cb55]" />
                      {formatRelativeTime(manga.updatedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors truncate">
                  {manga.title}
                </h3>
                <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5 truncate">
                  {manga.author}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ==================== SECTION 3: ALL BOOKS ==================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
              {sysLang === 'id' ? 'SEMUA KOMIK' : 'ALL BOOKS'}
            </h2>

            {/* Icon-Only Language Filter (Globe / ID / EN) */}
            <div className="inline-flex items-center gap-1 bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setHomeLang('')}
                title={sysLang === 'id' ? 'Semua Bahasa' : 'All Languages'}
                className={`p-1.5 rounded-lg transition-all ${
                  homeLang === ''
                    ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                    : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setHomeLang('id')}
                title="Bahasa Indonesia"
                className={`p-1.5 rounded-lg transition-all ${
                  homeLang === 'id'
                    ? 'bg-[#f9cb55] ring-2 ring-[#f9cb55]/50 shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <FlagIdIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setHomeLang('en')}
                title="English"
                className={`p-1.5 rounded-lg transition-all ${
                  homeLang === 'en'
                    ? 'bg-[#f9cb55] ring-2 ring-[#f9cb55]/50 shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <FlagEnIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Link
            to={homeLang ? `/books?lang=${homeLang}` : '/books'}
            className="p-1.5 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <span className="hidden sm:inline">
              {sysLang === 'id' ? 'Lihat Katalog' : 'Explore Catalog'}
            </span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {allBooksPreview.map((manga) => (
            <div
              key={manga.id}
              className="group flex flex-col gap-2"
            >
              <Link
                to={`/manga/${manga.id}${homeLang ? `?lang=${homeLang}` : ''}`}
                state={{ manga }}
                className="relative aspect-[3/4.2] w-full rounded-2xl overflow-hidden bg-[#ececec] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] shadow-md group-hover:shadow-lg transition-all"
              >
                <img
                  src={manga.coverUrl}
                  alt={manga.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/85 via-transparent to-transparent opacity-90" />
                
                {/* Source badge top left */}
                <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                  {manga.id.startsWith('komikindo:') || manga.source === 'komikindo' ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-600 text-white shadow-sm">
                      Komikindo
                    </span>
                  ) : manga.id.startsWith('komiku:') || manga.source === 'komiku' ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-600 text-white shadow-sm">
                      Komiku
                    </span>
                  ) : null}
                </div>

                {/* Country flag / origin top right */}
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#121212]/85 text-[#f8f8f8] backdrop-blur-sm border border-white/10 uppercase">
                  {manga.originalLanguage === 'ko'
                    ? 'KR'
                    : manga.originalLanguage === 'zh'
                    ? 'CN'
                    : 'JP'}
                </span>

                {/* Bottom Overlay: Chapter & Relative Time (Komiku Style) */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-zinc-200 font-semibold">
                  {manga.lastChapter ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#121212]/85 text-[#f9cb55] flex items-center gap-1 backdrop-blur-sm border border-[#f9cb55]/30">
                      <BookOpen className="w-2.5 h-2.5" />
                      Ch. {manga.lastChapter}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[#121212]/85 text-zinc-300">
                      Detail
                    </span>
                  )}
                  {manga.updatedAt && (
                    <span className="text-[10px] text-zinc-300/90 flex items-center gap-0.5 px-1 py-0.5 rounded bg-[#121212]/85 backdrop-blur-sm">
                      <Clock className="w-2.5 h-2.5 text-[#f9cb55]" />
                      {formatRelativeTime(manga.updatedAt)}
                    </span>
                  )}
                </div>
              </Link>

              <div className="px-0.5">
                <Link
                  to={`/manga/${manga.id}${homeLang ? `?lang=${homeLang}` : ''}`}
                  state={{ manga }}
                  className="font-semibold text-xs sm:text-sm text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#f9cb55] transition-colors line-clamp-1 block leading-snug"
                >
                  {manga.title}
                </Link>

                <div className="flex items-center justify-between gap-1 mt-1 text-[11px] text-[#6e6e6e] dark:text-[#c1c1c1]">
                  <p className="truncate flex-1">
                    {manga.author}
                  </p>
                  {manga.lastChapter && (
                    <Link
                      to={manga.lastChapterId ? `/read/${manga.lastChapterId}` : `/manga/${manga.id}`}
                      state={{ manga }}
                      className="shrink-0 text-[10px] font-bold text-[#f9cb55] hover:underline"
                    >
                      Ch. {manga.lastChapter}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ==================== FEATURED GENRE / CATEGORY CIRCLE CARDS (Photo 1 Match) ==================== */}
        <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              labelId: 'Isekai',
              labelEn: 'Isekai',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/isekai.jpg'),
              fallbackImg: 'https://komiku.org/asset/img/isekai.jpg',
              to: `/books?genre=isekai&tag=ace04997-f6bd-436e-b261-779182193d3d${homeLang ? `&lang=${homeLang}` : ''}`,
            },
            {
              labelId: 'Fantasi',
              labelEn: 'Fantasy',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/fantasy.png'),
              fallbackImg: 'https://komiku.org/asset/img/fantasy.png',
              to: `/books?genre=fantasy&tag=cdc58593-87dd-415e-bbc0-2ec27bf404cc${homeLang ? `&lang=${homeLang}` : ''}`,
            },
            {
              labelId: 'Ecchi',
              labelEn: 'Ecchi',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/ecchi.jpg'),
              fallbackImg: 'https://komiku.org/asset/img/ecchi.jpg',
              to: `/books?genre=ecchi&contentRating=suggestive${homeLang ? `&lang=${homeLang}` : ''}`,
            },
            {
              labelId: 'Romantis',
              labelEn: 'Romance',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/Romantis.png'),
              fallbackImg: 'https://komiku.org/asset/img/Romantis.png',
              to: `/books?genre=romance&tag=423e2eae-a7a2-4a8b-ac03-a8351462d71d${homeLang ? `&lang=${homeLang}` : ''}`,
            },
            {
              labelId: 'Berwarna',
              labelEn: 'Full-Color',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/full-color.jpg'),
              fallbackImg: 'https://komiku.org/asset/img/full-color.jpg',
              to: `/books?genre=berwarna&tipe=manhwa${homeLang ? `&lang=${homeLang}` : ''}`,
            },
            {
              labelId: 'Tamat',
              labelEn: 'Completed',
              img: '/api/proxy-image?url=' + encodeURIComponent('https://komiku.org/asset/img/Tamat.png'),
              fallbackImg: 'https://komiku.org/asset/img/Tamat.png',
              to: `/books?status=completed${homeLang ? `&lang=${homeLang}` : ''}`,
            },
          ].map((cat) => (
            <Link
              key={cat.labelId}
              to={cat.to}
              className="group flex flex-col items-center justify-between p-4 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] hover:border-[#f9cb55] shadow-sm hover:shadow-xl transition-all"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#ececec] dark:bg-[#242424] shadow-md">
                <img
                  src={cat.img}
                  alt={cat.labelId}
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== cat.fallbackImg) {
                      e.currentTarget.src = cat.fallbackImg;
                    }
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <h4 className="font-bold text-sm text-[#121212] dark:text-[#f8f8f8] mt-3">
                {sysLang === 'id' ? cat.labelId : cat.labelEn}
              </h4>

              <span className="mt-2 px-5 py-1.5 rounded-lg bg-[#ececec] dark:bg-[#262626] group-hover:bg-[#f9cb55] text-xs font-semibold text-[#121212] dark:text-[#f8f8f8] group-hover:text-[#121212] transition-colors">
                {sysLang === 'id' ? 'Baca' : 'Read'}
              </span>
            </Link>
          ))}
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            to={homeLang ? `/books?lang=${homeLang}` : '/books'}
            className="px-8 py-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] hover:border-[#f9cb55] text-xs font-bold uppercase tracking-widest text-[#121212] dark:text-[#f8f8f8] transition-all shadow-sm"
          >
            {sysLang === 'id' ? 'JELAJAHI SEMUA KOMIK →' : 'BROWSE ALL BOOKS →'}
          </Link>
        </div>
      </section>
    </div>
  );
};

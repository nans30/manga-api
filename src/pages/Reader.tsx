import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Chapter, ChapterPage } from '../types';
import {
  addReadingHistory,
  getSavedReaderMode,
  setSavedReaderMode,
  ReaderViewMode,
  getTheme,
  setTheme,
  ThemeMode,
  getCachedMangaById,
  useSysLang,
} from '../storage';
import {
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sun,
  Moon,
  Rows,
  Hand,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export const Reader: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sysLang] = useSysLang();

  const mangaIdParam = searchParams.get('mangaId') || '';
  const langParam = searchParams.get('lang') || 'all';

  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [chapterMeta, setChapterMeta] = useState<any>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Two Reading Modes: 'tap' (Full-Screen Tap Kanan-Kiri) & 'scroll' (Vertical Scroll)
  const [mode, setMode] = useState<ReaderViewMode>(() => getSavedReaderMode());
  const [quality, setQuality] = useState<'data-saver' | 'data'>('data-saver');
  const [currentPage, setCurrentPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [mangaInfo, setMangaInfo] = useState<any>(null);

  // Touch swipe tracking for mobile Tap mode
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleModeChange = (nextMode: ReaderViewMode) => {
    setMode(nextMode);
    setSavedReaderMode(nextMode);
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setHudVisible(false);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setHudVisible(true);
      }
    } catch {
      // Fallback for browsers where fullscreen API is restricted: toggle immersive HUD hide
      setIsFullscreen((prev) => !prev);
      setHudVisible((prev) => !prev);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load chapter pages
  useEffect(() => {
    if (!chapterId) return;
    setLoading(true);
    setError('');
    setCurrentPage(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    fetch(`/api/chapter/${chapterId}?quality=${quality}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          const loadedPages: ChapterPage[] = json.pages || [];
          setPages(loadedPages);
          setChapterMeta(json.chapter || null);

          const mId = json.chapter?.mangaId || mangaIdParam;
          if (mId) {
            const cachedM = getCachedMangaById(mId);
            if (cachedM) {
              setMangaInfo(cachedM);
            } else {
              fetch(`/api/manga/${mId}`)
                .then((r) => r.json())
                .then((mJson) => {
                  if (mJson.data) setMangaInfo(mJson.data);
                })
                .catch(() => {});
            }
          }
        }
      })
      .catch((err) => setError(err.message || 'Gagal memuat halaman komik'))
      .finally(() => setLoading(false));
  }, [chapterId, quality, mangaIdParam]);

  // Update reading progress percentage as user flips/scrolls pages
  useEffect(() => {
    if (!mangaInfo || !chapterId || pages.length === 0) return;
    const pct = Math.min(
      100,
      Math.max(5, Math.round(((currentPage + 1) / pages.length) * 100))
    );
    addReadingHistory({
      mangaId: mangaInfo.id,
      mangaTitle: mangaInfo.title,
      author: mangaInfo.author,
      coverUrl: mangaInfo.coverUrl,
      chapterId,
      chapterNumber: chapterMeta?.chapter || '1',
      chapterTitle: chapterMeta?.title || '',
      language: chapterMeta?.translatedLanguage || 'en',
      currentPage: currentPage + 1,
      totalPages: pages.length,
      progressPercent: pct,
      readAt: new Date().toISOString(),
    });
  }, [currentPage, mangaInfo, chapterId, pages.length, chapterMeta]);

  // Load sibling chapters for Prev / Next navigation
  useEffect(() => {
    const activeMangaId = chapterMeta?.mangaId || mangaIdParam;
    if (!activeMangaId) return;

    fetch(`/api/manga/${activeMangaId}/chapters?lang=${langParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChapterList(json.data);
        }
      })
      .catch(() => {});
  }, [chapterMeta?.mangaId, mangaIdParam, langParam]);

  const activeMangaId = chapterMeta?.mangaId || mangaIdParam;
  const currentIndex = chapterList.findIndex((c) => c.id === chapterId);
  const nextChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const prevChapter =
    currentIndex >= 0 && currentIndex < chapterList.length - 1
      ? chapterList[currentIndex + 1]
      : null;

  const goPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else if (prevChapter) {
      navigate(`/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`);
    }
  }, [currentPage, prevChapter, navigate, activeMangaId, langParam]);

  const goNextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else if (nextChapter) {
      navigate(`/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`);
    }
  }, [currentPage, pages.length, nextChapter, navigate, activeMangaId, langParam]);

  // Preload next 3 pages in background when in Tap mode for 0ms page turn
  useEffect(() => {
    if (mode !== 'tap' || pages.length === 0) return;
    [currentPage + 1, currentPage + 2, currentPage + 3].forEach((idx) => {
      if (pages[idx]) {
        const img = new Image();
        img.src = pages[idx].url;
      }
    });
  }, [mode, currentPage, pages]);

  // Keyboard Left / Right arrow & F key fullscreen support on PC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
        return;
      }
      if (mode !== 'tap') return;
      if (e.key === 'ArrowRight') goNextPage();
      else if (e.key === 'ArrowLeft') goPrevPage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, goNextPage, goPrevPage]);

  // Track visible page index during vertical scroll mode
  useEffect(() => {
    if (mode !== 'scroll' || pages.length === 0) return;
    const onScroll = () => {
      const imgs = document.querySelectorAll('[data-page-idx]');
      const viewportCenter = window.innerHeight / 2;
      for (let i = 0; i < imgs.length; i++) {
        const rect = imgs[i].getBoundingClientRect();
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
          setCurrentPage(i);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mode, pages.length]);

  return (
    <div className="min-h-screen bg-[#121212] text-[#f8f8f8] transition-colors select-none">
      {/* ==================== TOP HEADER (Auto-hides in Fullscreen / Tap Tengah) ==================== */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl bg-[#f8f8f8]/95 dark:bg-[#121212]/95 text-[#121212] dark:text-[#f8f8f8] border-b border-[#c1c1c1]/30 dark:border-[#242424] transition-all duration-300 ${
          !hudVisible && mode === 'tap'
            ? '-translate-y-full opacity-0 pointer-events-none fixed inset-x-0'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Left Close X */}
          <Link
            to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
            className="p-2 -ml-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
            title="Tutup Bacaan"
          >
            <X className="w-6 h-6" />
          </Link>

          {/* Center CHAPTER X / Page Y */}
          <div className="text-center">
            <h1 className="font-manga text-lg sm:text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8] uppercase leading-none">
              CHAPTER {chapterMeta?.chapter || '...'}
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5">
              {sysLang === 'id' ? 'Halaman' : 'Page'}{' '}
              {pages.length > 0 ? currentPage + 1 : 0}{' '}
              {pages.length > 0 ? `/ ${pages.length}` : ''}
            </p>
          </div>

          {/* Right Fullscreen + Hamburger Menu ☰ */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors"
              title={
                isFullscreen
                  ? sysLang === 'id'
                    ? 'Keluar Layar Penuh'
                    : 'Exit Fullscreen'
                  : sysLang === 'id'
                  ? 'Layar Penuh (Fullscreen)'
                  : 'Fullscreen'
              }
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-[#f9cb55]" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 -mr-2 transition-colors ${
                menuOpen
                  ? 'text-[#f9cb55]'
                  : 'text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55]'
              }`}
              aria-label="Pengaturan Baca"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Instant Mode Switcher Bar (Scroll vs Tap Kanan-Kiri + Light/Dark) */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center bg-[#ececec] dark:bg-[#1c1c1c] p-1 rounded-xl border border-[#c1c1c1]/30 dark:border-[#2a2a2a]">
            <button
              onClick={() => handleModeChange('tap')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                mode === 'tap'
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              Tap Kanan-Kiri
            </button>
            <button
              onClick={() => handleModeChange('scroll')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                mode === 'scroll'
                  ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                  : 'text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Mode Scroll
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Chapter Dropdown */}
            {chapterList.length > 0 && (
              <select
                value={chapterId}
                onChange={(e) =>
                  navigate(`/read/${e.target.value}?mangaId=${activeMangaId}&lang=${langParam}`)
                }
                className="bg-[#ececec] dark:bg-[#1c1c1c] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#121212] dark:text-[#f8f8f8] focus:outline-none focus:border-[#f9cb55]"
              >
                {chapterList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch. {ch.chapter} ({ch.translatedLanguage.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            {/* Theme Toggle inside Reader */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[#ececec] dark:bg-[#1c1c1c] border border-[#c1c1c1]/30 dark:border-[#2a2a2a] text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55]"
              title="Ubah Light / Dark Mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#f9cb55]" />
              ) : (
                <Moon className="w-4 h-4 text-[#121212]" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Settings Drawer when ☰ is clicked */}
        {menuOpen && (
          <div className="bg-[#ffffff] dark:bg-[#1b1b1b] border-t border-[#c1c1c1]/30 dark:border-[#2a2a2a] px-5 py-4 shadow-xl">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6e6e6e] dark:text-[#c1c1c1] font-medium">
                  {sysLang === 'id' ? 'Kualitas Gambar:' : 'Image Quality:'}
                </span>
                <button
                  onClick={() => setQuality('data-saver')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    quality === 'data-saver'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  Data Saver
                </button>
                <button
                  onClick={() => setQuality('data')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    quality === 'data'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  HD Original
                </button>
              </div>

              <div className="text-[#6e6e6e] dark:text-[#c1c1c1]">
                {sysLang === 'id'
                  ? 'Tips: Tap Tengah gambar untuk sembunyikan menu • Panah ← → atau F untuk Fullscreen'
                  : 'Tip: Tap Center to hide menu • Arrow keys ← → or F for Fullscreen'}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ==================== MAIN READER CONTENT ==================== */}
      <main
        className={
          mode === 'tap'
            ? 'w-full max-w-5xl mx-auto px-0 pb-20'
            : 'max-w-4xl mx-auto px-0 sm:px-4 pt-2 pb-24'
        }
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3">
            <Loader2 className="w-10 h-10 text-[#f9cb55] animate-spin" />
            <p className="text-xs font-medium text-[#c1c1c1]">
              {sysLang === 'id' ? 'Memuat halaman komik...' : 'Loading comic pages...'}
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-24 space-y-4">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-[#f9cb55] text-[#121212] font-manga"
            >
              TRY AGAIN
            </button>
          </div>
        ) : mode === 'tap' ? (
          /* ==================== MODE 1: FULL-SCREEN TAP KANAN-KIRI (HP & PC) ==================== */
          <div className="relative w-full">
            {pages[currentPage] && (
              <div
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                  touchStartY.current = e.touches[0].clientY;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null || touchStartY.current === null) return;
                  const diffX = e.changedTouches[0].clientX - touchStartX.current;
                  const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
                  // Only trigger horizontal page swipe if horizontal movement dominates vertical scroll
                  if (Math.abs(diffX) > 50 && Math.abs(diffX) > diffY) {
                    if (diffX < -50) goNextPage();
                    else if (diffX > 50) goPrevPage();
                  }
                  touchStartX.current = null;
                  touchStartY.current = null;
                }}
                className="relative w-full min-h-[calc(100vh-60px)] bg-[#121212] flex items-center justify-center overflow-hidden"
              >
                <img
                  src={pages[currentPage].url}
                  alt={`Page ${currentPage + 1}`}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== pages[currentPage].rawUrl) {
                      target.src = pages[currentPage].rawUrl;
                    }
                  }}
                  className="w-full h-auto block mx-auto object-contain"
                />

                {/* Left 40% Tap Zone -> Prev Page */}
                <div
                  onClick={goPrevPage}
                  className="fixed inset-y-0 left-0 w-[38%] z-20 cursor-pointer group flex items-center justify-start pl-2 sm:pl-5"
                  title={sysLang === 'id' ? 'Tap untuk Halaman Sebelumnya' : 'Previous Page'}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#121212]/70 border border-[#c1c1c1]/25 text-[#f8f8f8] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                </div>

                {/* Center 24% Tap Zone -> Toggle Fullscreen HUD */}
                <div
                  onClick={() => setHudVisible((v) => !v)}
                  className="fixed inset-y-0 left-[38%] w-[24%] z-20 cursor-pointer"
                  title={
                    sysLang === 'id'
                      ? 'Tap untuk Munculkan / Sembunyikan Menu'
                      : 'Tap to Show / Hide Menu'
                  }
                />

                {/* Right 38% Tap Zone -> Next Page */}
                <div
                  onClick={goNextPage}
                  className="fixed inset-y-0 right-0 w-[38%] z-20 cursor-pointer group flex items-center justify-end pr-2 sm:pr-5"
                  title={sysLang === 'id' ? 'Tap untuk Halaman Selanjutnya' : 'Next Page'}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f9cb55]/90 text-[#121212] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Floating Bottom Page Slider & Controls (Auto-hides with HUD or stays compact) */}
            <div
              className={`fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-40 transition-all duration-300 ${
                hudVisible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-24 opacity-0 pointer-events-none'
              }`}
            >
              <div className="space-y-2.5 bg-[#1b1b1b]/95 backdrop-blur-xl border border-[#c1c1c1]/25 p-3 sm:p-4 rounded-2xl shadow-2xl text-[#f8f8f8]">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <button
                    onClick={goPrevPage}
                    disabled={currentPage === 0 && !prevChapter}
                    className="px-3.5 py-2 rounded-xl bg-[#2a2a2a] text-[#f8f8f8] disabled:opacity-30 hover:bg-[#f9cb55] hover:text-[#121212] transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-manga text-sm tracking-wider text-[#f9cb55]">
                      PAGE {currentPage + 1} / {pages.length}
                    </span>
                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#f9cb55] hover:text-[#121212] transition-colors"
                      title="Fullscreen"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={goNextPage}
                    disabled={currentPage >= pages.length - 1 && !nextChapter}
                    className="px-3.5 py-2 rounded-xl bg-[#f9cb55] text-[#121212] disabled:opacity-30 hover:scale-105 transition-transform flex items-center gap-1 font-bold"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, pages.length - 1)}
                  value={currentPage}
                  onChange={(e) => {
                    setCurrentPage(Number(e.target.value));
                    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                  }}
                  className="w-full accent-[#f9cb55] cursor-pointer"
                />
              </div>
            </div>

            {/* Minimal Page Badge when HUD is hidden in Fullscreen */}
            {!hudVisible && (
              <button
                onClick={() => setHudVisible(true)}
                className="fixed bottom-3 right-3 z-40 px-3 py-1.5 rounded-full bg-[#121212]/80 border border-[#c1c1c1]/20 text-[11px] font-bold text-[#f9cb55] backdrop-blur-md shadow-lg"
              >
                {currentPage + 1} / {pages.length}
              </button>
            )}
          </div>
        ) : (
          /* ==================== MODE 2: VERTICAL SCROLL (Webtoon Mode) ==================== */
          <div className="sm:rounded-[24px] overflow-hidden border-y sm:border border-[#c1c1c1]/40 dark:border-[#262626] bg-[#121212] shadow-2xl">
            {pages.map((p, idx) => (
              <img
                key={p.index}
                data-page-idx={idx}
                src={p.url}
                alt={`Page ${p.index}`}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== p.rawUrl) {
                    target.src = p.rawUrl;
                  }
                }}
                className="w-full h-auto block"
              />
            ))}
          </div>
        )}

        {/* Next / Previous Chapter Footer */}
        {!loading && pages.length > 0 && (
          <div className="mt-8 mx-4 sm:mx-0 p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#262626] text-center space-y-4">
            <p className="font-manga text-lg tracking-wider">
              FINISHED CHAPTER {chapterMeta?.chapter}
            </p>
            <div className="flex items-center justify-center gap-4">
              {prevChapter && (
                <Link
                  to={`/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                  className="px-5 py-3 rounded-xl bg-[#ececec] dark:bg-[#252525] text-xs font-bold uppercase tracking-wider text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55]"
                >
                  ← Ch. {prevChapter.chapter}
                </Link>
              )}

              {nextChapter ? (
                <Link
                  to={`/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                  className="px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-base tracking-wider shadow-lg shadow-[#f9cb55]/20 hover:scale-105 transition-transform"
                >
                  NEXT CHAPTER ({nextChapter.chapter}) →
                </Link>
              ) : (
                <Link
                  to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
                  className="px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-base tracking-wider"
                >
                  BACK TO MANGA
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

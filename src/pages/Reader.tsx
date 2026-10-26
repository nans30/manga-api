import React, { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';

export const Reader: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mangaIdParam = searchParams.get('mangaId') || '';
  const langParam = searchParams.get('lang') || 'all';

  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [chapterMeta, setChapterMeta] = useState<any>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Two Reading Modes: 'tap' (Tap Kanan-Kiri / Framed Screen 3 style) & 'scroll' (Vertical Scroll)
  const [mode, setMode] = useState<ReaderViewMode>(() => getSavedReaderMode());
  const [quality, setQuality] = useState<'data-saver' | 'data'>('data-saver');
  const [currentPage, setCurrentPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [mangaInfo, setMangaInfo] = useState<any>(null);

  // Touch swipe tracking for mobile Tap mode
  const touchStartX = useRef<number | null>(null);

  const handleModeChange = (nextMode: ReaderViewMode) => {
    setMode(nextMode);
    setSavedReaderMode(nextMode);
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

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
            fetch(`/api/manga/${mId}`)
              .then((r) => r.json())
              .then((mJson) => {
                if (mJson.data) {
                  setMangaInfo(mJson.data);
                  addReadingHistory({
                    mangaId: mId,
                    mangaTitle: mJson.data.title,
                    author: mJson.data.author,
                    coverUrl: mJson.data.coverUrl,
                    chapterId: chapterId,
                    chapterNumber: json.chapter?.chapter || '1',
                    chapterTitle: json.chapter?.title || '',
                    language: json.chapter?.translatedLanguage || 'en',
                    currentPage: 1,
                    totalPages: loadedPages.length || 1,
                    progressPercent: loadedPages.length
                      ? Math.max(5, Math.round((1 / loadedPages.length) * 100))
                      : 78,
                    readAt: new Date().toISOString(),
                  });
                }
              })
              .catch(() => {});
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

  const goPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (prevChapter) {
      navigate(`/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`);
    }
  };

  const goNextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nextChapter) {
      navigate(`/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`);
    }
  };

  // Keyboard Left / Right arrow support on PC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'tap') return;
      if (e.key === 'ArrowRight') goNextPage();
      else if (e.key === 'ArrowLeft') goPrevPage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
    <div className="min-h-screen bg-[#f8f8f8] dark:bg-[#121212] text-[#121212] dark:text-[#f8f8f8] transition-colors select-none">
      {/* ==================== TOP HEADER (Exact Screen 3 Match: X | CHAPTER 3 / Page 130 | ☰) ==================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#f8f8f8]/90 dark:bg-[#121212]/90 border-b border-[#c1c1c1]/30 dark:border-[#242424]">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
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
            <h1 className="font-manga text-xl sm:text-2xl tracking-wider text-[#121212] dark:text-[#f8f8f8] uppercase leading-none">
              CHAPTER {chapterMeta?.chapter || '...'}
            </h1>
            <p className="text-xs font-medium text-[#6e6e6e] dark:text-[#c1c1c1] mt-1">
              Page {pages.length > 0 ? currentPage + 1 : 0}{' '}
              {pages.length > 0 ? `of ${pages.length}` : ''}
            </p>
          </div>

          {/* Right Hamburger Menu ☰ */}
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

        {/* Instant Mode Switcher Bar (Scroll vs Tap Kanan-Kiri + Light/Dark) */}
        <div className="max-w-4xl mx-auto px-5 pb-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center bg-[#ececec] dark:bg-[#1c1c1c] p-1 rounded-xl border border-[#c1c1c1]/30 dark:border-[#2a2a2a]">
            <button
              onClick={() => handleModeChange('tap')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
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
            <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6e6e6e] dark:text-[#c1c1c1] font-medium">
                  Kualitas Gambar:
                </span>
                <button
                  onClick={() => setQuality('data-saver')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    quality === 'data-saver'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  Data Saver (Cepat)
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
                Tips: Di PC bisa pakai tombol panah <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525]">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#252525]">→</kbd>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ==================== MAIN READER CONTENT ==================== */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-10 h-10 text-[#f9cb55] animate-spin" />
            <p className="text-xs font-medium text-[#6e6e6e] dark:text-[#c1c1c1]">
              Memuat halaman komik...
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
          /* ==================== MODE 1: TAP KANAN-KIRI (Screen 3 Framed Style) ==================== */
          <div className="space-y-6">
            {pages[currentPage] && (
              <div
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const diff = e.changedTouches[0].clientX - touchStartX.current;
                  if (diff < -45) goNextPage();
                  else if (diff > 45) goPrevPage();
                  touchStartX.current = null;
                }}
                className="relative p-2.5 sm:p-3 rounded-[28px] border border-[#c1c1c1]/60 dark:border-[#c1c1c1]/35 bg-[#ffffff] dark:bg-[#181818] shadow-2xl overflow-hidden"
              >
                <div className="relative rounded-[20px] overflow-hidden bg-[#ececec] dark:bg-[#121212] min-h-[55vh] flex items-center justify-center">
                  <img
                    src={pages[currentPage].url}
                    alt={`Page ${currentPage + 1}`}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== pages[currentPage].rawUrl) {
                        target.src = pages[currentPage].rawUrl;
                      }
                    }}
                    className="max-h-[80vh] w-auto mx-auto object-contain"
                  />

                  {/* Left 45% Tap Zone -> Prev Page */}
                  <div
                    onClick={goPrevPage}
                    className="absolute inset-y-0 left-0 w-[45%] cursor-pointer group flex items-center justify-start pl-3"
                    title="Tap untuk Halaman Sebelumnya"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#121212]/60 text-[#f8f8f8] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Right 55% Tap Zone -> Next Page */}
                  <div
                    onClick={goNextPage}
                    className="absolute inset-y-0 right-0 w-[55%] cursor-pointer group flex items-center justify-end pr-3"
                    title="Tap untuk Halaman Selanjutnya"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#f9cb55]/90 text-[#121212] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Page Slider & Tap Controls */}
            <div className="space-y-3 bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] p-4 rounded-2xl">
              <div className="flex items-center justify-between text-xs font-semibold">
                <button
                  onClick={goPrevPage}
                  disabled={currentPage === 0 && !prevChapter}
                  className="px-4 py-2 rounded-xl bg-[#ececec] dark:bg-[#252525] text-[#121212] dark:text-[#f8f8f8] disabled:opacity-30 hover:bg-[#f9cb55] hover:text-[#121212] transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                <span className="font-manga text-sm tracking-wider">
                  PAGE {currentPage + 1} / {pages.length}
                </span>

                <button
                  onClick={goNextPage}
                  disabled={currentPage >= pages.length - 1 && !nextChapter}
                  className="px-4 py-2 rounded-xl bg-[#f9cb55] text-[#121212] disabled:opacity-30 hover:scale-105 transition-transform flex items-center gap-1"
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
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="w-full accent-[#f9cb55] cursor-pointer"
              />
            </div>
          </div>
        ) : (
          /* ==================== MODE 2: VERTICAL SCROLL (Webtoon Mode) ==================== */
          <div className="rounded-[24px] overflow-hidden border border-[#c1c1c1]/40 dark:border-[#262626] bg-[#121212] shadow-2xl">
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
          <div className="mt-8 p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] text-center space-y-4">
            <p className="font-manga text-lg tracking-wider text-[#121212] dark:text-[#f8f8f8]">
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

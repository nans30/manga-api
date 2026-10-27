import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Chapter, ChapterPage } from '../types';
import {
  addReadingHistory,
  getSavedReaderMode,
  setSavedReaderMode,
  ReaderViewMode,
  getSavedSpreadMode,
  setSavedSpreadMode,
  ReaderSpreadMode,
  getSavedFitMode,
  setSavedFitMode,
  ReaderFitMode,
  getSavedAutoNextOnScroll,
  setSavedAutoNextOnScroll,
  getTheme,
  setTheme,
  ThemeMode,
  getCachedMangaById,
  isBookmarked,
  toggleBookmark,
  useSysLang,
} from '../storage';
import { NavBookmarkIcon } from '../components/Icons';
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
  BookOpen,
  Sparkles,
  Check,
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
  const [spreadMode, setSpreadMode] = useState<ReaderSpreadMode>(() => getSavedSpreadMode());
  const [fitMode, setFitMode] = useState<ReaderFitMode>(() => getSavedFitMode());
  const [autoNextOnScroll, setAutoNextOnScroll] = useState<boolean>(() =>
    getSavedAutoNextOnScroll()
  );
  const [autoNavigating, setAutoNavigating] = useState<boolean>(false);
  const autoNavigatingRef = useRef<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const autoNextCancelled = useRef<boolean>(false);
  const chapterLoadedAt = useRef<number>(0);
  const [quality, setQuality] = useState<'data-saver' | 'data'>('data-saver');
  const [currentPage, setCurrentPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Brief non-intrusive hint shown ONLY at the start of Tap Kanan-Kiri mode
  const [showTapHint, setShowTapHint] = useState(false);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState('');
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [mangaInfo, setMangaInfo] = useState<any>(null);
  const [containerMinHeight, setContainerMinHeight] = useState<number>(0);

  // Touch & scroll tracking so scrolling never triggers page jump or scroll-to-top
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isTouchScrolling = useRef<boolean>(false);
  const lastScrollTime = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Show the Kiri / Kanan hint briefly (2.2s) only at the beginning when in Tap mode
  useEffect(() => {
    if (mode === 'tap' && !loading && pages.length > 0) {
      setShowTapHint(true);
      const timer = setTimeout(() => {
        setShowTapHint(false);
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      setShowTapHint(false);
    }
  }, [mode, loading, chapterId, pages.length]);

  const handleModeChange = (nextMode: ReaderViewMode) => {
    setMode(nextMode);
    setSavedReaderMode(nextMode);
  };

  const handleSpreadModeChange = (nextSpread: ReaderSpreadMode) => {
    setSpreadMode(nextSpread);
    setSavedSpreadMode(nextSpread);
  };

  const handleFitModeChange = (nextFit: ReaderFitMode) => {
    setFitMode(nextFit);
    setSavedFitMode(nextFit);
  };

  const handleToggleBookmark = () => {
    if (!mangaInfo) return;
    const next = toggleBookmark(mangaInfo);
    setBookmarked(next);
    setBookmarkToast(
      next
        ? sysLang === 'id'
          ? 'Tersimpan di Bookmark!'
          : 'Saved to Bookmarks!'
        : sysLang === 'id'
        ? 'Dihapus dari Bookmark'
        : 'Removed from Bookmarks'
    );
    setTimeout(() => setBookmarkToast(''), 2500);
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  const enterFullscreen = async () => {
    try {
      const doc = document as any;
      const elem = document.documentElement as any;
      if (
        !doc.fullscreenElement &&
        !doc.webkitFullscreenElement &&
        !doc.mozFullScreenElement &&
        !doc.msFullscreenElement
      ) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      }
    } catch {
      // Fallback for mobile browsers without requestFullscreen (visual fullscreen)
    }
    setIsFullscreen(true);
    setHudVisible(false);
  };

  const exitFullscreen = async () => {
    try {
      const doc = document as any;
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch {
      // Ignore
    }
    setIsFullscreen(false);
    setHudVisible(true);
  };

  const toggleFullscreen = async () => {
    const doc = document as any;
    const fsActive = Boolean(
      isFullscreen ||
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
    );
    if (fsActive) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      const fsActive = Boolean(
        doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
      );
      setIsFullscreen(fsActive);
      if (!fsActive) {
        setHudVisible(true);
      } else {
        setHudVisible(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, []);

  // Load chapter pages
  useEffect(() => {
    if (!chapterId) return;
    setLoading(true);
    setError('');
    setCurrentPage(0);
    autoNavigatingRef.current = false;
    autoNextCancelled.current = false;
    chapterLoadedAt.current = Date.now();
    setAutoNavigating(false);
    setCountdown(3);
    setShowEndPrompt(false);
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
            setBookmarked(isBookmarked(mId));
            const cachedM = getCachedMangaById(mId);
            if (cachedM) {
              setMangaInfo(cachedM);
              setBookmarked(isBookmarked(cachedM.id));
            } else {
              fetch(`/api/manga/${mId}`)
                .then((r) => r.json())
                .then((mJson) => {
                  if (mJson.data) {
                    setMangaInfo(mJson.data);
                    setBookmarked(isBookmarked(mJson.data.id));
                  }
                })
                .catch(() => {});
            }
          }
        }
      })
      .catch((err) => setError(err.message || 'Gagal memuat halaman komik'))
      .finally(() => {
        setLoading(false);
        chapterLoadedAt.current = Date.now();
      });
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

  // Load sibling chapters for Prev / Next navigation (Deduplicated by episode number)
  useEffect(() => {
    const activeMangaId = chapterMeta?.mangaId || mangaIdParam;
    if (!activeMangaId) return;

    fetch(`/api/manga/${activeMangaId}/chapters?lang=${langParam}&prefer=${sysLang}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const uniqueMap = new Map<string, Chapter>();
          for (const ch of json.data as Chapter[]) {
            const key = String(ch.chapter).trim();
            const existing = uniqueMap.get(key);
            if (
              !existing ||
              ch.id === chapterId ||
              (existing.id !== chapterId &&
                existing.translatedLanguage !== sysLang &&
                ch.translatedLanguage === sysLang)
            ) {
              uniqueMap.set(key, ch);
            }
          }
          setChapterList(Array.from(uniqueMap.values()));
        }
      })
      .catch(() => {});
  }, [chapterMeta?.mangaId, mangaIdParam, langParam, sysLang, chapterId]);

  const activeMangaId = chapterMeta?.mangaId || mangaIdParam;
  const currentIndex = chapterList.findIndex((c) => c.id === chapterId);
  const nextChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const prevChapter =
    currentIndex >= 0 && currentIndex < chapterList.length - 1
      ? chapterList[currentIndex + 1]
      : null;

  // Preserve scroll position when turning pages so it NEVER jumps unexpectedly to the top
  const changePagePreserveScroll = useCallback((nextPageIdx: number) => {
    const savedScrollY = window.scrollY;
    if (imgRef.current) {
      const h = imgRef.current.getBoundingClientRect().height;
      if (h > 100) setContainerMinHeight(h);
    }
    setCurrentPage(nextPageIdx);
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
    });
  }, []);

  const goPrevPage = useCallback(() => {
    // Ignore accidental tap immediately after a vertical scroll gesture
    if (isTouchScrolling.current || Date.now() - lastScrollTime.current < 180) {
      return;
    }
    setShowTapHint(false);
    const step = spreadMode === 'double' ? 2 : 1;
    if (currentPage > 0) {
      changePagePreserveScroll(Math.max(0, currentPage - step));
    } else if (prevChapter) {
      navigate(
        `/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`,
        { replace: true }
      );
    }
  }, [
    currentPage,
    spreadMode,
    prevChapter,
    navigate,
    activeMangaId,
    langParam,
    changePagePreserveScroll,
  ]);

  const goNextPage = useCallback(() => {
    // Ignore accidental tap immediately after a vertical scroll gesture
    if (isTouchScrolling.current || Date.now() - lastScrollTime.current < 180) {
      return;
    }
    setShowTapHint(false);
    const step = spreadMode === 'double' ? 2 : 1;
    if (currentPage + step < pages.length) {
      changePagePreserveScroll(currentPage + step);
    } else if (currentPage < pages.length - 1) {
      changePagePreserveScroll(pages.length - 1);
    } else {
      setShowEndPrompt(true);
      if (nextChapter) {
        // Can open next chapter prompt
      }
    }
  }, [
    currentPage,
    spreadMode,
    pages.length,
    nextChapter,
    changePagePreserveScroll,
  ]);

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

  // Keyboard Left / Right arrow, Escape & F key fullscreen support on PC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
        return;
      }
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
  }, [mode, isFullscreen, goNextPage, goPrevPage]);

  const cancelAutoNext = useCallback(() => {
    autoNavigatingRef.current = false;
    autoNextCancelled.current = true;
    setAutoNavigating(false);
    setCountdown(3);
  }, []);

  const proceedNextChapterImmediately = useCallback(() => {
    if (!nextChapter) return;
    autoNavigatingRef.current = false;
    navigate(
      `/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`,
      { replace: true }
    );
  }, [nextChapter, activeMangaId, langParam, navigate]);

  // Track scroll events both for Scroll mode page index & preventing accidental Tap during scroll
  useEffect(() => {
    const onScroll = () => {
      lastScrollTime.current = Date.now();
      if (mode !== 'scroll' || pages.length === 0 || loading) return;

      const imgs = document.querySelectorAll('[data-page-idx]');
      const viewportCenter = window.innerHeight / 2;
      for (let i = 0; i < imgs.length; i++) {
        const rect = imgs[i].getBoundingClientRect();
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
          setCurrentPage(i);
          break;
        }
      }

      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;

      // If user scrolls back up by at least 300px from bottom, cancel any pending auto-next countdown
      if (scrollBottom < docHeight - 300) {
        if (autoNextCancelled.current) {
          autoNextCancelled.current = false; // Reset cancel flag so future intentional scroll-to-bottom works
        }
        if (autoNavigatingRef.current) {
          autoNavigatingRef.current = false;
          setAutoNavigating(false);
          setCountdown(3);
        }
        return;
      }

      // Guard: do not auto-navigate if chapter was loaded less than 2.5 seconds ago (prevents jump on load)
      const timeSinceLoad = Date.now() - chapterLoadedAt.current;
      if (timeSinceLoad < 2500) return;

      // Guard: ensure the document height is genuinely expanded (images rendered)
      if (docHeight <= window.innerHeight + 400) return;

      // Guard: user must be on/near the end of pages (e.g. at least page length - 2)
      const isNearEndPages = pages.length <= 2 || currentPage >= pages.length - 2;
      if (!isNearEndPages) return;

      // Auto-load next chapter when scrolled to the bottom in Scroll mode
      if (scrollBottom >= docHeight - 120) {
        if (nextChapter && autoNextOnScroll) {
          if (!autoNavigatingRef.current && !autoNextCancelled.current) {
            autoNavigatingRef.current = true;
            setCountdown(3);
            setAutoNavigating(true);
          }
        } else if (!nextChapter && !autoNavigatingRef.current && !showEndPrompt) {
          setShowEndPrompt(true);
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [
    mode,
    pages.length,
    nextChapter,
    autoNextOnScroll,
    loading,
    currentPage,
    showEndPrompt,
  ]);

  // Handle 3s countdown & cancellation for smooth auto-navigation to next chapter on scroll bottom
  useEffect(() => {
    if (!autoNavigating || !nextChapter) {
      setCountdown(3);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(
            `/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`,
            { replace: true }
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoNavigating, nextChapter, activeMangaId, langParam, navigate]);

  return (
    <div className="min-h-screen bg-[#121212] text-[#f8f8f8] transition-colors select-none">
      {/* ==================== FLOATING EXIT FULLSCREEN BUTTON (Always visible when in Fullscreen / Hidden HUD) ==================== */}
      {(isFullscreen || !hudVisible) && (
        <button
          onClick={exitFullscreen}
          className="fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#121212]/85 hover:bg-[#f9cb55] text-[#f8f8f8] hover:text-[#121212] border border-[#f9cb55]/60 backdrop-blur-md text-xs font-bold shadow-2xl transition-all cursor-pointer"
          title={sysLang === 'id' ? 'Keluar Full Screen' : 'Exit Full Screen'}
        >
          <Minimize2 className="w-4 h-4 text-[#f9cb55] group-hover:text-[#121212]" />
          <span>{sysLang === 'id' ? 'Tutup Fullscreen' : 'Exit Fullscreen'}</span>
        </button>
      )}

      {/* ==================== TOP HEADER (Auto-hides in Fullscreen / Tap Tengah) ==================== */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl bg-[#f8f8f8]/95 dark:bg-[#121212]/95 text-[#121212] dark:text-[#f8f8f8] border-b border-[#c1c1c1]/30 dark:border-[#242424] transition-all duration-300 ${
          isFullscreen || !hudVisible
            ? '-translate-y-full opacity-0 pointer-events-none fixed inset-x-0'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Left Close X */}
          <Link
            to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
            replace
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

          {/* Right Bookmark + Fullscreen + Hamburger Menu ☰ */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleBookmark}
              className="p-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] transition-colors relative"
              title={
                bookmarked
                  ? sysLang === 'id'
                    ? 'Hapus Bookmark'
                    : 'Remove Bookmark'
                  : sysLang === 'id'
                  ? 'Simpan ke Bookmark'
                  : 'Bookmark Manga'
              }
            >
              <NavBookmarkIcon active={bookmarked} className="w-5 h-5" />
            </button>

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
                  navigate(
                    `/read/${e.target.value}?mangaId=${activeMangaId}&lang=${langParam}`,
                    { replace: true }
                  )
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
          <div className="bg-[#ffffff] dark:bg-[#1b1b1b] border-t border-[#c1c1c1]/30 dark:border-[#2a2a2a] px-5 py-4 shadow-xl space-y-3">
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

              {/* Desktop Double Page Spread Toggle */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[#6e6e6e] dark:text-[#c1c1c1] font-medium">
                  {sysLang === 'id' ? 'Tampilan PC:' : 'Desktop View:'}
                </span>
                <button
                  onClick={() => handleSpreadModeChange('single')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    spreadMode === 'single'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  1 Halaman
                </button>
                <button
                  onClick={() => handleSpreadModeChange('double')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    spreadMode === 'double'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  2 Halaman (Spread)
                </button>
              </div>

              {/* Fit Width / Fit Height Scale Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[#6e6e6e] dark:text-[#c1c1c1] font-medium">
                  {sysLang === 'id' ? 'Skala:' : 'Scale:'}
                </span>
                <button
                  onClick={() => handleFitModeChange('width')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    fitMode === 'width'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  Fit Lebar
                </button>
                <button
                  onClick={() => handleFitModeChange('height')}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    fitMode === 'height'
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  Fit Tinggi
                </button>
              </div>

              {/* Auto Next Chapter on Scroll Bottom Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[#6e6e6e] dark:text-[#c1c1c1] font-medium">
                  {sysLang === 'id' ? 'Auto Next Scroll Bawah:' : 'Auto Next on Scroll:'}
                </span>
                <button
                  onClick={() => {
                    const next = !autoNextOnScroll;
                    setAutoNextOnScroll(next);
                    setSavedAutoNextOnScroll(next);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    autoNextOnScroll
                      ? 'bg-[#f9cb55] text-[#121212]'
                      : 'bg-[#ececec] dark:bg-[#252525] text-[#6e6e6e] dark:text-[#c1c1c1]'
                  }`}
                >
                  {autoNextOnScroll
                    ? sysLang === 'id'
                      ? 'Aktif'
                      : 'Enabled'
                    : sysLang === 'id'
                    ? 'Nonaktif'
                    : 'Disabled'}
                </button>
              </div>

              {pages.length > 1 && (
                <div className="flex items-center gap-3 w-full sm:w-72">
                  <span className="text-[#6e6e6e] dark:text-[#c1c1c1] shrink-0">
                    Hal {currentPage + 1}/{pages.length}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, pages.length - 1)}
                    value={currentPage}
                    onChange={(e) => {
                      changePagePreserveScroll(Number(e.target.value));
                    }}
                    className="w-full accent-[#f9cb55] cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ==================== MAIN READER CONTENT ==================== */}
      <main
        className={
          mode === 'tap'
            ? 'w-full max-w-5xl mx-auto px-0 pb-16'
            : `max-w-4xl mx-auto px-0 sm:px-4 pb-24 ${
                isFullscreen || !hudVisible ? 'pt-0' : 'pt-2'
              }`
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
          /* ==================== MODE 1: FULL-SCREEN TAP KANAN-KIRI (100% Clean, No Scroll Jump) ==================== */
          <div className="relative w-full">
            {/* Initial 2.2-Second Non-Intrusive Guide (Shown ONLY at the beginning, pointer-events-none) */}
            <div
              className={`fixed inset-x-0 bottom-8 z-40 flex justify-center px-4 pointer-events-none transition-all duration-500 ${
                showTapHint
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="inline-flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-2.5 rounded-2xl bg-[#121212]/85 backdrop-blur-md border border-[#f9cb55]/50 text-[#f8f8f8] text-xs font-semibold shadow-2xl">
                <span className="flex items-center gap-1 text-[#c1c1c1]">
                  <ChevronLeft className="w-4 h-4 text-[#f9cb55]" />
                  {sysLang === 'id' ? 'Tap Kiri: Sebelumnya' : 'Tap Left: Prev'}
                </span>
                <span className="text-[#c1c1c1]/40">|</span>
                <span className="text-[#f9cb55]">
                  {sysLang === 'id' ? 'Tap Kanan: Selanjutnya' : 'Tap Right: Next'}
                </span>
                <ChevronRight className="w-4 h-4 text-[#f9cb55] -ml-2" />
              </div>
            </div>

            {pages[currentPage] && (
              <div
                style={{
                  minHeight: containerMinHeight > 0 ? `${containerMinHeight}px` : 'calc(100vh - 56px)',
                }}
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                  touchStartY.current = e.touches[0].clientY;
                  isTouchScrolling.current = false;
                }}
                onTouchMove={(e) => {
                  if (touchStartY.current === null || touchStartX.current === null) return;
                  const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
                  const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
                  if (dy > 12 && dy > dx) {
                    isTouchScrolling.current = true;
                  }
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null || touchStartY.current === null) return;
                  const diffX = e.changedTouches[0].clientX - touchStartX.current;
                  const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
                  if (!isTouchScrolling.current && Math.abs(diffX) > 55 && Math.abs(diffX) > diffY * 1.5) {
                    if (diffX < -55) goNextPage();
                    else if (diffX > 55) goPrevPage();
                  }
                  touchStartX.current = null;
                  touchStartY.current = null;
                  setTimeout(() => {
                    isTouchScrolling.current = false;
                  }, 120);
                }}
                className="relative w-full bg-[#121212] flex items-start justify-center overflow-hidden"
              >
                <div
                  className={`w-full flex items-center justify-center gap-1.5 ${
                    spreadMode === 'double' && pages[currentPage + 1] ? 'flex-row' : ''
                  }`}
                >
                  <img
                    ref={imgRef}
                    src={pages[currentPage].url}
                    alt={`Page ${currentPage + 1}`}
                    onLoad={(e) => {
                      const h = e.currentTarget.getBoundingClientRect().height;
                      if (h > 100) setContainerMinHeight(h);
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== pages[currentPage].rawUrl) {
                        target.src = pages[currentPage].rawUrl;
                      }
                    }}
                    className={`block object-contain transition-all ${
                      spreadMode === 'double' && pages[currentPage + 1]
                        ? fitMode === 'height'
                          ? 'max-h-[88vh] w-auto max-w-[49%]'
                          : 'w-1/2 h-auto'
                        : fitMode === 'height'
                        ? 'max-h-[92vh] w-auto max-w-full'
                        : 'w-full h-auto mx-auto'
                    }`}
                  />
                  {spreadMode === 'double' && pages[currentPage + 1] && (
                    <img
                      src={pages[currentPage + 1].url}
                      alt={`Page ${currentPage + 2}`}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== pages[currentPage + 1].rawUrl) {
                          target.src = pages[currentPage + 1].rawUrl;
                        }
                      }}
                      className={`block object-contain transition-all ${
                        fitMode === 'height'
                          ? 'max-h-[88vh] w-auto max-w-[49%]'
                          : 'w-1/2 h-auto'
                      }`}
                    />
                  )}
                </div>

                {/* Completely Invisible Left Tap Zone (42% width) -> Prev Page */}
                <div
                  onClick={goPrevPage}
                  className="absolute inset-y-0 left-0 w-[42%] z-20 cursor-pointer"
                />

                {/* Completely Invisible Center Tap Zone (16% width) -> Toggle Top Bar */}
                <div
                  onClick={() => {
                    if (isTouchScrolling.current) return;
                    setShowTapHint(false);
                    setHudVisible((v) => !v);
                  }}
                  className="absolute inset-y-0 left-[42%] w-[16%] z-20 cursor-pointer"
                />

                {/* Completely Invisible Right Tap Zone (42% width) -> Next Page */}
                <div
                  onClick={goNextPage}
                  className="absolute inset-y-0 right-0 w-[42%] z-20 cursor-pointer"
                />
              </div>
            )}
          </div>
        ) : (
          /* ==================== MODE 2: VERTICAL SCROLL (Webtoon Mode) ==================== */
          <div
            onClick={() => {
              if (isTouchScrolling.current) return;
              if (Date.now() - lastScrollTime.current < 200) return;
              setHudVisible((v) => !v);
            }}
            className="sm:rounded-[24px] overflow-hidden border-y sm:border border-[#c1c1c1]/40 dark:border-[#262626] bg-[#121212] shadow-2xl cursor-pointer"
          >
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
                className={`block mx-auto ${
                  fitMode === 'height'
                    ? 'max-h-[92vh] w-auto max-w-full'
                    : 'w-full h-auto'
                }`}
              />
            ))}

            {/* Seamless Next Chapter Transition Banner in Scroll Mode */}
            {nextChapter && (
              <div className="py-10 px-4 text-center border-t border-[#c1c1c1]/20 bg-gradient-to-b from-transparent to-[#181818] space-y-3">
                <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-[#f9cb55]/15 border border-[#f9cb55]/50 text-[#f9cb55] text-xs font-bold shadow-md">
                  <Loader2 className="w-4 h-4 animate-spin text-[#f9cb55]" />
                  <span>
                    {autoNextOnScroll
                      ? sysLang === 'id'
                        ? `Scroll mentok bawah untuk langsung membuka Chapter ${nextChapter.chapter} →`
                        : `Scroll to bottom to auto-open Chapter ${nextChapter.chapter} →`
                      : sysLang === 'id'
                      ? `Tersedia Chapter ${nextChapter.chapter}`
                      : `Chapter ${nextChapter.chapter} available`}
                  </span>
                </div>
                <div>
                  <button
                    onClick={() => {
                      navigate(
                        `/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`,
                        { replace: true }
                      );
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] font-manga text-xs sm:text-sm tracking-wider font-bold shadow-lg transition-all cursor-pointer"
                  >
                    {sysLang === 'id'
                      ? `BUKA CHAPTER ${nextChapter.chapter} SEKARANG →`
                      : `OPEN CHAPTER ${nextChapter.chapter} NOW →`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== FLOATING AUTO-NEXT CHAPTER PROMPT ==================== */}
        {showEndPrompt && (
          <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 p-4 sm:p-5 rounded-3xl bg-[#1b1b1b]/95 text-[#f8f8f8] border border-[#f9cb55]/70 backdrop-blur-xl shadow-2xl text-center space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#f9cb55] uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                {sysLang === 'id'
                  ? `Chapter ${chapterMeta?.chapter} Selesai!`
                  : `Chapter ${chapterMeta?.chapter} Finished!`}
              </span>
              <button
                onClick={() => setShowEndPrompt(false)}
                className="text-[#c1c1c1] hover:text-[#f8f8f8] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#c1c1c1]">
              {nextChapter
                ? sysLang === 'id'
                  ? `Lanjut membaca ke Chapter ${nextChapter.chapter}?`
                  : `Continue reading Chapter ${nextChapter.chapter}?`
                : sysLang === 'id'
                ? 'Kamu telah menyelesaikan semua chapter yang tersedia!'
                : 'You have reached the latest available chapter!'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {nextChapter ? (
                <button
                  onClick={() => {
                    setShowEndPrompt(false);
                    navigate(
                      `/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`,
                      { replace: true }
                    );
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-xs sm:text-sm tracking-wider font-bold shadow-lg shadow-[#f9cb55]/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {sysLang === 'id'
                    ? `LANJUT CH. ${nextChapter.chapter} →`
                    : `NEXT CH. ${nextChapter.chapter} →`}
                </button>
              ) : (
                <Link
                  to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
                  replace
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-xs sm:text-sm tracking-wider font-bold"
                >
                  {sysLang === 'id' ? 'DETAIL KOMIK' : 'MANGA DETAIL'}
                </Link>
              )}
              <button
                onClick={() => setShowEndPrompt(false)}
                className="py-2.5 px-3.5 rounded-xl bg-[#2a2a2a] hover:bg-[#353535] text-[#f8f8f8] text-xs font-semibold transition-colors"
              >
                {sysLang === 'id' ? 'Tutup' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}

        {/* Floating Auto-Navigating Countdown Indicator with Cancel & Open Now */}
        {autoNavigating && nextChapter && (
          <div className="fixed bottom-6 inset-x-4 max-w-sm mx-auto z-50 p-4 rounded-2xl bg-[#151515]/95 border-2 border-[#f9cb55] backdrop-blur-xl shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#f9cb55]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f9cb55] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f9cb55]"></span>
                </span>
                <span>
                  {sysLang === 'id'
                    ? `Menuju Chapter ${nextChapter.chapter}`
                    : `Next: Chapter ${nextChapter.chapter}`}
                </span>
              </div>
              <button
                onClick={cancelAutoNext}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f8f8f8] border border-[#3f3f3f] cursor-pointer transition-colors"
                title={sysLang === 'id' ? 'Batalkan pindah chapter otomatis' : 'Cancel auto next'}
              >
                <X className="w-3.5 h-3.5 text-[#e57373]" />
                <span>{sysLang === 'id' ? 'Batal' : 'Cancel'}</span>
              </button>
            </div>

            {/* Visual Countdown Progress Bar */}
            <div className="w-full bg-[#252525] h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#f9cb55] to-[#f59e0b] transition-all ease-linear"
                style={{
                  width: `${Math.max(0, (countdown / 3) * 100)}%`,
                  transitionDuration: '1000ms',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#c1c1c1] pt-0.5">
              <span>
                {sysLang === 'id'
                  ? `Otomatis pindah dalam ${countdown} dtk...`
                  : `Switching in ${countdown}s...`}
              </span>
              <button
                onClick={proceedNextChapterImmediately}
                className="font-bold text-[#f9cb55] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>{sysLang === 'id' ? 'Buka Sekarang' : 'Open Now'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Bookmark Toast Feedback */}
        {bookmarkToast && (
          <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#121212]/90 border border-[#f9cb55] text-[#f8f8f8] text-xs font-bold shadow-2xl backdrop-blur-md">
              <Check className="w-4 h-4 text-[#f9cb55]" />
              <span>{bookmarkToast}</span>
            </div>
          </div>
        )}

        {/* Next / Previous Chapter Footer */}
        {!loading && pages.length > 0 && (
          <div className="mt-8 mx-4 sm:mx-0 p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#262626] text-center space-y-4">
            <p className="font-manga text-lg tracking-wider">
              {mode === 'tap'
                ? `PAGE ${currentPage + 1} / ${pages.length} • CHAPTER ${chapterMeta?.chapter}`
                : `FINISHED CHAPTER ${chapterMeta?.chapter}`}
            </p>
            <div className="flex items-center justify-center gap-4">
              {prevChapter && (
                <Link
                  to={`/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                  replace
                  className="px-5 py-3 rounded-xl bg-[#ececec] dark:bg-[#252525] text-xs font-bold uppercase tracking-wider text-[#121212] dark:text-[#f8f8f8] hover:border-[#f9cb55]"
                >
                  ← Ch. {prevChapter.chapter}
                </Link>
              )}

              {nextChapter ? (
                <Link
                  to={`/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                  replace
                  className="px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-base tracking-wider shadow-lg shadow-[#f9cb55]/20 hover:scale-105 transition-transform"
                >
                  NEXT CHAPTER ({nextChapter.chapter}) →
                </Link>
              ) : (
                <Link
                  to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
                  replace
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

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Manga, ReadingHistoryItem } from '../types';
import {
  getBookmarks,
  toggleBookmark,
  getReadingHistory,
  clearReadingHistory,
  exportLibraryData,
  importLibraryData,
  getTheme,
  setTheme,
  ThemeMode,
  getSavedReaderMode,
  setSavedReaderMode,
  ReaderViewMode,
  getStorageUsage,
  clearAppCache,
  useSysLang,
  getMangaDescription,
} from '../storage';
import { NavBookmarkIcon } from '../components/Icons';
import {
  ArrowLeft,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  Star,
  Sun,
  Moon,
  Hand,
  Rows,
  HardDrive,
  RefreshCw,
  BookMarked,
  BookOpen,
  Sparkles,
  Search,
  X,
  Image as ImageIcon,
} from 'lucide-react';

export const Library: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get('tab');
  const [sysLang] = useSysLang();

  const [tab, setTab] = useState<'bookmarks' | 'history' | 'profile'>(
    activeTabParam === 'profile'
      ? 'profile'
      : activeTabParam === 'history'
      ? 'history'
      : 'bookmarks'
  );
  const [bookmarks, setBookmarks] = useState<Manga[]>([]);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [bookmarkCategory, setBookmarkCategory] = useState<
    'all' | 'updates' | 'reading' | 'plan' | 'completed'
  >('all');
  const [storageInfo, setStorageInfo] = useState(() => getStorageUsage());
  const [syncMessage, setSyncMessage] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [defaultReaderMode, setDefaultReaderMode] = useState<ReaderViewMode>(() =>
    getSavedReaderMode()
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setSyncMessage('Ciarán berhasil diinstall ke perangkat Anda!');
      }
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (activeTabParam === 'profile') setTab('profile');
    else if (activeTabParam === 'history') setTab('history');
    else setTab('bookmarks');
  }, [activeTabParam]);

  const refreshData = () => {
    setBookmarks(getBookmarks());
    setHistory(getReadingHistory());
    setStorageInfo(getStorageUsage());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('ciaran-storage-update', refreshData);
    return () => window.removeEventListener('ciaran-storage-update', refreshData);
  }, []);

  const switchTab = (nextTab: 'bookmarks' | 'history' | 'profile') => {
    setTab(nextTab);
    if (nextTab === 'bookmarks') setSearchParams({});
    else setSearchParams({ tab: nextTab });
  };

  const handleExport = () => {
    const dataStr = exportLibraryData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciaran-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSyncMessage('Backup JSON berhasil diunduh!');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importLibraryData(String(reader.result || ''));
      if (ok) {
        refreshData();
        setSyncMessage('Koleksi & riwayat berhasil dipulihkan!');
      } else {
        setSyncMessage('File JSON tidak valid.');
      }
      setTimeout(() => setSyncMessage(''), 3500);
    };
    reader.readAsText(file);
  };

  const downloadAsset = async (
    url: string,
    filename: string,
    asPng = false,
    width = 1024,
    height = 1024
  ) => {
    try {
      const res = await fetch(url);
      const svgText = await res.text();

      if (!asPng) {
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        setSyncMessage(`✓ Berhasil mengunduh ${filename}`);
        setTimeout(() => setSyncMessage(''), 3000);
        return;
      }

      // Convert SVG to High-Resolution PNG via Canvas
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const a = document.createElement('a');
              a.href = pngUrl;
              a.download = filename.replace(/\.svg$/, '.png');
              a.click();
              URL.revokeObjectURL(pngUrl);
              setSyncMessage(`✓ Berhasil mengunduh ${filename.replace(/\.svg$/, '.png')}`);
              setTimeout(() => setSyncMessage(''), 3000);
            }
            URL.revokeObjectURL(blobUrl);
          }, 'image/png');
        }
      };
      img.src = blobUrl;
    } catch {
      setSyncMessage('Gagal mengunduh aset logo.');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleThemeChange = (next: ThemeMode) => {
    setThemeState(next);
    setTheme(next);
  };

  const handleReaderModePref = (next: ReaderViewMode) => {
    setDefaultReaderMode(next);
    setSavedReaderMode(next);
  };

  const checkHasUpdate = (b: Manga) => {
    const h = history.find((x) => x.mangaId === b.id);
    if (!h) return false;
    const matchLast = String(b.lastChapter || '').match(/[0-9]+(?:\.[0-9]+)?/);
    const lastNum = matchLast ? parseFloat(matchLast[0]) : -1;
    const matchRead = String(h.chapterNumber || '').match(/[0-9]+(?:\.[0-9]+)?/);
    const readNum = matchRead ? parseFloat(matchRead[0]) : -1;
    return lastNum > 0 && readNum > 0 && lastNum > readNum;
  };

  const countAll = bookmarks.length;
  const countUpdates = bookmarks.filter(checkHasUpdate).length;
  const countReading = bookmarks.filter((b) =>
    history.some((h) => h.mangaId === b.id && (h.progressPercent || 0) < 100)
  ).length;
  const countPlan = bookmarks.filter(
    (b) => !history.some((h) => h.mangaId === b.id)
  ).length;
  const countCompleted = bookmarks.filter(
    (b) =>
      b.status === 'completed' ||
      b.status === 'end' ||
      history.some((h) => h.mangaId === b.id && (h.progressPercent || 0) >= 100)
  ).length;

  const filteredBookmarks = bookmarks.filter((b) => {
    if (bookmarkCategory === 'all') return true;
    if (bookmarkCategory === 'updates') return checkHasUpdate(b);
    const h = history.find((x) => x.mangaId === b.id);
    if (bookmarkCategory === 'reading') return h && (h.progressPercent || 0) < 100;
    if (bookmarkCategory === 'plan') return !h;
    if (bookmarkCategory === 'completed')
      return (
        b.status === 'completed' ||
        b.status === 'end' ||
        (h && (h.progressPercent || 0) >= 100)
      );
    return true;
  });

  const searchedBookmarks = filteredBookmarks.filter((b) => {
    if (!librarySearch.trim()) return true;
    const q = librarySearch.trim().toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.author && b.author.toLowerCase().includes(q))
    );
  });

  const searchedHistory = history.filter((h) => {
    if (!librarySearch.trim()) return true;
    const q = librarySearch.trim().toLowerCase();
    return (
      h.mangaTitle.toLowerCase().includes(q) ||
      (h.author && h.author.toLowerCase().includes(q)) ||
      String(h.chapterNumber).includes(q)
    );
  });

  const handleClearCache = () => {
    clearAppCache(true);
    refreshData();
    setSyncMessage(
      sysLang === 'id'
        ? 'Cache aplikasi dibersihkan! Bookmark Anda tetap aman.'
        : 'App cache cleared! Your bookmarks remain safe.'
    );
    setTimeout(() => setSyncMessage(''), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-6 pb-28 md:pb-16 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55]"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="font-manga text-2xl sm:text-3xl tracking-wider text-[#121212] dark:text-[#f8f8f8]">
          {tab === 'profile' ? 'SETTINGS & SYNC' : 'MY LIBRARY'}
        </h1>

        <div className="w-8" />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => switchTab('bookmarks')}
          className={`px-5 py-2.5 rounded-xl font-manga text-sm tracking-wider uppercase transition-all ${
            tab === 'bookmarks'
              ? 'bg-[#f9cb55] text-[#121212] shadow-md'
              : 'bg-[#ffffff] dark:bg-[#1e1e1e] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#2a2a2a]'
          }`}
        >
          SAVED ({bookmarks.length})
        </button>

        <button
          onClick={() => switchTab('history')}
          className={`px-5 py-2.5 rounded-xl font-manga text-sm tracking-wider uppercase transition-all ${
            tab === 'history'
              ? 'bg-[#f9cb55] text-[#121212] shadow-md'
              : 'bg-[#ffffff] dark:bg-[#1e1e1e] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#2a2a2a]'
          }`}
        >
          HISTORY ({history.length})
        </button>

        <button
          onClick={() => switchTab('profile')}
          className={`px-5 py-2.5 rounded-xl font-manga text-sm tracking-wider uppercase transition-all ${
            tab === 'profile'
              ? 'bg-[#f9cb55] text-[#121212] shadow-md'
              : 'bg-[#ffffff] dark:bg-[#1e1e1e] text-[#121212] dark:text-[#f8f8f8] border border-[#c1c1c1]/30 dark:border-[#2a2a2a]'
          }`}
        >
          PREFERENCES
        </button>
      </div>

      {/* Optional Search within Library / History */}
      {tab !== 'profile' && ((tab === 'bookmarks' && bookmarks.length > 0) || (tab === 'history' && history.length > 0)) && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder={
              tab === 'bookmarks'
                ? sysLang === 'id'
                  ? 'Cari di komik tersimpan...'
                  : 'Search in saved books...'
                : sysLang === 'id'
                ? 'Cari di riwayat baca...'
                : 'Search in reading history...'
            }
            className="w-full bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/40 dark:border-[#2b2b2b] focus:border-[#f9cb55] rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-[#121212] dark:text-[#f8f8f8] placeholder:text-[#888888] focus:outline-none transition-colors"
          />
          {librarySearch && (
            <button
              onClick={() => setLibrarySearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#f9cb55]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {syncMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#f9cb55]/20 border border-[#f9cb55] text-[#121212] dark:text-[#f9cb55] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {syncMessage}
        </div>
      )}

      {/* TAB 1: SAVED BOOKMARKS */}
      {tab === 'bookmarks' && (
        <div className="space-y-5">
          {/* Sub-Category Filter Tabs (Semua, Sedang Dibaca, Rencana Baca, Tamat) */}
          {bookmarks.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                {
                  id: 'all',
                  label: sysLang === 'id' ? 'Semua' : 'All',
                  count: countAll,
                },
                ...(countUpdates > 0
                  ? [
                      {
                        id: 'updates',
                        label: sysLang === 'id' ? '🔥 Ada Update' : '🔥 New Updates',
                        count: countUpdates,
                      },
                    ]
                  : []),
                {
                  id: 'reading',
                  label: sysLang === 'id' ? 'Sedang Dibaca' : 'Reading',
                  count: countReading,
                },
                {
                  id: 'plan',
                  label: sysLang === 'id' ? 'Rencana Baca' : 'Plan to Read',
                  count: countPlan,
                },
                {
                  id: 'completed',
                  label: sysLang === 'id' ? 'Selesai' : 'Completed',
                  count: countCompleted,
                },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setBookmarkCategory(c.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    bookmarkCategory === c.id
                      ? 'bg-[#f9cb55] text-[#121212] shadow-sm'
                      : 'bg-[#ececec] dark:bg-[#1e1e1e] text-[#6e6e6e] dark:text-[#c1c1c1] hover:text-[#121212] dark:hover:text-[#f8f8f8]'
                  }`}
                >
                  {c.label} ({c.count})
                </button>
              ))}
            </div>
          )}

          {bookmarks.length === 0 ? (
            <div className="text-center py-20 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4">
              <p className="font-manga text-xl">NO SAVED BOOKS YET</p>
              <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                Tap ikon pita bookmark pada komik favoritmu untuk menyimpannya di sini.
              </p>
              <Link
                to="/books"
                className="inline-block px-6 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-sm"
              >
                EXPLORE ALL BOOKS →
              </Link>
            </div>
          ) : searchedBookmarks.length === 0 ? (
            <div className="text-center py-16 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-2">
              <p className="font-semibold text-sm">
                {librarySearch
                  ? sysLang === 'id'
                    ? `Tidak ada komik tersimpan untuk "${librarySearch}"`
                    : `No saved comics for "${librarySearch}"`
                  : sysLang === 'id'
                  ? 'Tidak ada komik pada kategori ini.'
                  : 'No comics in this category.'}
              </p>
              {librarySearch ? (
                <button
                  onClick={() => setLibrarySearch('')}
                  className="text-xs font-bold text-[#f9cb55] underline"
                >
                  {sysLang === 'id' ? 'Hapus Pencarian' : 'Clear Search'}
                </button>
              ) : (
                <button
                  onClick={() => setBookmarkCategory('all')}
                  className="text-xs font-bold text-[#f9cb55] underline"
                >
                  {sysLang === 'id' ? 'Tampilkan Semua' : 'Show All'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchedBookmarks.map((manga) => (
                <div
                  key={manga.id}
                  className="flex items-start gap-4 p-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626]"
                >
                  <Link
                    to={`/manga/${manga.id}`}
                    className="w-24 aspect-[3/4] rounded-xl overflow-hidden shrink-0"
                  >
                    <img
                      src={manga.coverUrl}
                      alt={manga.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/manga/${manga.id}`}
                        className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] line-clamp-1"
                      >
                        {manga.title}
                      </Link>
                      <button
                        onClick={() => {
                          toggleBookmark(manga);
                          refreshData();
                        }}
                        className="text-[#f9cb55]"
                        title="Hapus dari koleksi"
                      >
                        <NavBookmarkIcon active={true} className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-0.5 truncate">
                      {manga.author}
                    </p>
                    {(() => {
                      const h = history.find((x) => x.mangaId === manga.id);
                      const matchLast = String(manga.lastChapter || '').match(/[0-9]+(?:\.[0-9]+)?/);
                      const lastNum = matchLast ? parseFloat(matchLast[0]) : -1;
                      const matchRead = String(h?.chapterNumber || '').match(/[0-9]+(?:\.[0-9]+)?/);
                      const readNum = matchRead ? parseFloat(matchRead[0]) : -1;
                      const hasUpdate = lastNum > 0 && readNum > 0 && lastNum > readNum;
                      const diff = hasUpdate ? Math.max(1, Math.round(lastNum - readNum)) : 0;

                      return (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold">
                            <Star className="w-3.5 h-3.5 fill-current text-[#f9cb55]" />
                            5.0
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-extrabold text-[10px]">
                            SAVED
                          </span>
                          {hasUpdate && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-extrabold text-[10px] animate-pulse">
                              +{diff} Ch Baru
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] line-clamp-2 mt-2">
                      {getMangaDescription(manga, sysLang)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-[#c1c1c1]/20 dark:border-[#262626]">
                      <span className="text-[10px] text-[#888888]">{sysLang === 'id' ? 'Lacak:' : 'Track:'}</span>
                      <a
                        href={`https://anilist.co/search/manga?search=${encodeURIComponent(manga.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[#02A9FF] hover:underline"
                        title="Buka di AniList"
                      >
                        AniList ↗
                      </a>
                      <a
                        href={`https://myanimelist.net/manga.php?q=${encodeURIComponent(manga.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[#2E51A2] dark:text-[#7b9fe7] hover:underline"
                        title="Buka di MyAnimeList"
                      >
                        MAL ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: READING HISTORY */}
      {tab === 'history' && (
        <div className="space-y-4">
          {history.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  clearReadingHistory();
                  refreshData();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center py-20 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-3">
              <p className="font-manga text-xl">NO READING HISTORY</p>
              <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
                Chapter komik yang kamu baca akan tercatat otomatis di sini.
              </p>
            </div>
          ) : searchedHistory.length === 0 ? (
            <div className="text-center py-16 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-2">
              <p className="font-semibold text-sm">
                {sysLang === 'id'
                  ? `Tidak ada riwayat baca untuk "${librarySearch}"`
                  : `No reading history for "${librarySearch}"`}
              </p>
              <button
                onClick={() => setLibrarySearch('')}
                className="text-xs font-bold text-[#f9cb55] underline"
              >
                {sysLang === 'id' ? 'Hapus Pencarian' : 'Clear Search'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchedHistory.map((item) => (
                <div
                  key={`${item.mangaId}-${item.chapterId}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626]"
                >
                  <Link
                    to={`/manga/${item.mangaId}`}
                    className="w-20 aspect-[3/4] rounded-xl overflow-hidden shrink-0"
                  >
                    <img
                      src={item.coverUrl}
                      alt={item.mangaTitle}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 space-y-2">
                    <Link
                      to={`/manga/${item.mangaId}`}
                      className="font-semibold text-sm sm:text-base text-[#121212] dark:text-[#f8f8f8] hover:text-[#f9cb55] line-clamp-1"
                    >
                      {item.mangaTitle}
                    </Link>
                    <p className="text-xs font-medium text-[#6e6e6e] dark:text-[#c1c1c1]">
                      Chapter {item.chapterNumber} ({item.language.toUpperCase()})
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-[#e2e2e2] dark:bg-[#2a2a2a] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#f9cb55]"
                        style={{ width: `${item.progressPercent || 78}%` }}
                      />
                    </div>
                    <div className="pt-1">
                      <Link
                        to={`/read/${item.chapterId}?mangaId=${item.mangaId}&lang=${item.language}`}
                        className="inline-block px-4 py-1.5 rounded-lg bg-[#f9cb55] text-[#121212] font-manga text-xs tracking-wider"
                      >
                        CONTINUE READING →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE / THEME / READER PREFERENCES / BACKUP */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Mode Card */}
          <div className="p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4">
            <h3 className="font-manga text-xl tracking-wider">APPEARANCE (THEME)</h3>
            <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
              Pilih tampilan warna aplikasi sesuai kenyamanan mata (#121212 Dark Mode atau #f8f8f8 Light Mode).
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all ${
                  theme === 'dark'
                    ? 'bg-[#f9cb55] text-[#121212] border-[#f9cb55]'
                    : 'bg-[#ececec] dark:bg-[#242424] border-transparent text-[#6e6e6e] dark:text-[#c1c1c1]'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark Mode (#121212)
              </button>

              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all ${
                  theme === 'light'
                    ? 'bg-[#f9cb55] text-[#121212] border-[#f9cb55]'
                    : 'bg-[#ececec] dark:bg-[#242424] border-transparent text-[#6e6e6e] dark:text-[#c1c1c1]'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light Mode (#f8f8f8)
              </button>
            </div>
          </div>

          {/* Default Reader Mode Card */}
          <div className="p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4">
            <h3 className="font-manga text-xl tracking-wider">DEFAULT READING MODE</h3>
            <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
              Pilih gaya baca komik favoritmu (bisa diganti kapan saja saat membaca chapter).
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleReaderModePref('tap')}
                className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all ${
                  defaultReaderMode === 'tap'
                    ? 'bg-[#f9cb55] text-[#121212] border-[#f9cb55]'
                    : 'bg-[#ececec] dark:bg-[#242424] border-transparent text-[#6e6e6e] dark:text-[#c1c1c1]'
                }`}
              >
                <Hand className="w-4 h-4" />
                Tap Kanan-Kiri
              </button>

              <button
                onClick={() => handleReaderModePref('scroll')}
                className={`p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all ${
                  defaultReaderMode === 'scroll'
                    ? 'bg-[#f9cb55] text-[#121212] border-[#f9cb55]'
                    : 'bg-[#ececec] dark:bg-[#242424] border-transparent text-[#6e6e6e] dark:text-[#c1c1c1]'
                }`}
              >
                <Rows className="w-4 h-4" />
                Mode Scroll
              </button>
            </div>
          </div>

          {/* Storage & Cache Management Card (Mencegah Cache Menumpuk) */}
          <div className="p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-manga text-xl tracking-wider flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[#f9cb55]" />
                {sysLang === 'id' ? 'PENYIMPANAN & CACHE' : 'STORAGE & CACHE'}
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#ececec] dark:bg-[#252525] text-[#f9cb55]">
                {storageInfo.readable}
              </span>
            </div>
            <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
              {sysLang === 'id'
                ? 'Bersihkan cache chapter sementara dan data riwayat yang menumpuk. Komik yang Anda simpan di bookmark TIDAK AKAN terhapus.'
                : 'Clear temporary cached chapters and stale history. Your saved bookmarks will remain completely safe.'}
            </p>
            <div className="pt-1 flex items-center gap-3">
              <button
                onClick={handleClearCache}
                className="px-5 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-500 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {sysLang === 'id' ? 'Bersihkan Cache Komik' : 'Clear Comic Cache'}
              </button>
            </div>
          </div>

          {/* PWA Install App Card */}
          <div className="p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-4">
            <h3 className="font-manga text-xl tracking-wider flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#f9cb55]" />
              {sysLang === 'id' ? 'APLIKASI CIARÁN (PWA)' : 'CIARÁN APP (PWA)'}
            </h3>
            <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1]">
              {sysLang === 'id'
                ? 'Pasang Ciarán ke Layar Utama (Home Screen) smartphone atau desktop PC Anda untuk akses cepat dan layar penuh tanpa bilah browser.'
                : 'Install Ciarán to your device Home Screen for instant full-screen reading without browser bars.'}
            </p>
            <div className="pt-1">
              <button
                onClick={
                  deferredPrompt
                    ? handleInstallPwa
                    : () => {
                        setSyncMessage(
                          sysLang === 'id'
                            ? 'Buka menu browser Anda (titik 3) lalu pilih "Tambahkan ke Layar Utama" / "Install App".'
                            : 'Open your browser menu (3 dots) and select "Add to Home Screen" / "Install App".'
                        );
                        setTimeout(() => setSyncMessage(''), 5000);
                      }
                }
                className="px-5 py-2.5 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] font-manga text-xs tracking-wider font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {sysLang === 'id' ? 'INSTALL KE LAYAR UTAMA' : 'INSTALL TO HOME SCREEN'}
              </button>
            </div>
          </div>

          {/* Brand Assets, Logo & Mockup Download Section */}
          <div className="md:col-span-2 p-6 sm:p-8 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-manga text-xl sm:text-2xl tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#f9cb55]" />
                  {sysLang === 'id' ? 'LOGO & BRAND ASSETS KIT' : 'LOGO & BRAND ASSETS KIT'}
                </h3>
                <p className="text-xs sm:text-sm text-[#6e6e6e] dark:text-[#c1c1c1] mt-1">
                  {sysLang === 'id'
                    ? 'Simpan dan download logo resmi Ciarán (Vektor SVG, PNG High-Resolution, Mockup Smartphone 3D, dan Banner).'
                    : 'Download official Ciarán assets (Vector SVG, High-Res PNG, 3D Smartphone Mockup, and Social Banner).'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Asset 1: App Icon */}
              <div className="p-4 rounded-2xl bg-[#ececec]/50 dark:bg-[#222225] border border-[#c1c1c1]/30 dark:border-[#2f2f36] flex flex-col items-center text-center space-y-3">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg border border-black/10">
                  <img src="/brand/ciaran-icon.svg" alt="Ciaran Icon" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">App Icon (512x512)</h4>
                  <p className="text-[11px] text-[#888888]">Squircle Icon</p>
                </div>
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-icon.svg', 'ciaran-icon.svg')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#ffffff] dark:bg-[#2c2c32] hover:border-[#f9cb55] border border-[#c1c1c1]/40 dark:border-[#3a3a42] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f9cb55]" /> SVG
                  </button>
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-icon.svg', 'ciaran-icon.png', true, 512, 512)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                </div>
              </div>

              {/* Asset 2: Logo Horizontal (Light) */}
              <div className="p-4 rounded-2xl bg-[#ececec]/50 dark:bg-[#222225] border border-[#c1c1c1]/30 dark:border-[#2f2f36] flex flex-col items-center text-center space-y-3">
                <div className="w-full h-24 rounded-2xl bg-white p-2 flex items-center justify-center shadow-sm border border-black/5">
                  <img src="/brand/ciaran-logo-horizontal.svg" alt="Ciaran Logo Light" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">Logo Horizontal (Light)</h4>
                  <p className="text-[11px] text-[#888888]">Header &amp; Wordmark</p>
                </div>
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-logo-horizontal.svg', 'ciaran-logo-light.svg')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#ffffff] dark:bg-[#2c2c32] hover:border-[#f9cb55] border border-[#c1c1c1]/40 dark:border-[#3a3a42] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f9cb55]" /> SVG
                  </button>
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-logo-horizontal.svg', 'ciaran-logo-light.png', true, 1680, 480)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                </div>
              </div>

              {/* Asset 3: Logo Dark Card */}
              <div className="p-4 rounded-2xl bg-[#ececec]/50 dark:bg-[#222225] border border-[#c1c1c1]/30 dark:border-[#2f2f36] flex flex-col items-center text-center space-y-3">
                <div className="w-full h-24 rounded-2xl bg-[#121212] p-2 flex items-center justify-center shadow-sm border border-[#27272a]">
                  <img src="/brand/ciaran-logo-dark.svg" alt="Ciaran Logo Dark" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">Logo Dark Card</h4>
                  <p className="text-[11px] text-[#888888]">Dark Background</p>
                </div>
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-logo-dark.svg', 'ciaran-logo-dark.svg')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#ffffff] dark:bg-[#2c2c32] hover:border-[#f9cb55] border border-[#c1c1c1]/40 dark:border-[#3a3a42] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f9cb55]" /> SVG
                  </button>
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-logo-dark.svg', 'ciaran-logo-dark.png', true, 1680, 480)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                </div>
              </div>

              {/* Asset 4: 3D App Mockup */}
              <div className="p-4 rounded-2xl bg-[#ececec]/50 dark:bg-[#222225] border border-[#c1c1c1]/30 dark:border-[#2f2f36] flex flex-col items-center text-center space-y-3">
                <div className="w-full h-24 rounded-2xl bg-[#121212] p-1 flex items-center justify-center shadow-sm border border-[#27272a] overflow-hidden">
                  <img src="/brand/ciaran-mockup.svg" alt="Ciaran 3D Mockup" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">3D Smartphone Mockup</h4>
                  <p className="text-[11px] text-[#888888]">Device Presentation</p>
                </div>
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-mockup.svg', 'ciaran-mockup.svg')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#ffffff] dark:bg-[#2c2c32] hover:border-[#f9cb55] border border-[#c1c1c1]/40 dark:border-[#3a3a42] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f9cb55]" /> SVG
                  </button>
                  <button
                    onClick={() => downloadAsset('/brand/ciaran-mockup.svg', 'ciaran-mockup.png', true, 2000, 1600)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </button>
                </div>
              </div>
            </div>

            {/* Social Banner Asset */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#ececec]/50 dark:bg-[#222225] border border-[#c1c1c1]/30 dark:border-[#2f2f36] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-28 h-16 rounded-xl overflow-hidden shadow-sm shrink-0 border border-black/10">
                  <img src="/brand/ciaran-banner.svg" alt="Ciaran Banner" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Social Media &amp; Promo Banner (1200x630)</h4>
                  <p className="text-xs text-[#888888]">Cocok untuk OpenGraph, Twitter/X, Discord, atau banner promosi.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => downloadAsset('/brand/ciaran-banner.svg', 'ciaran-banner.svg')}
                  className="py-2 px-3.5 rounded-xl bg-[#ffffff] dark:bg-[#2c2c32] hover:border-[#f9cb55] border border-[#c1c1c1]/40 dark:border-[#3a3a42] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#f9cb55]" /> Unduh SVG
                </button>
                <button
                  onClick={() => downloadAsset('/brand/ciaran-banner.svg', 'ciaran-banner.png', true, 1200, 630)}
                  className="py-2 px-4 rounded-xl bg-[#f9cb55] hover:bg-[#eab83e] text-[#121212] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh PNG High-Res
                </button>
              </div>
            </div>
          </div>

          {/* Backup & Sync PC <-> HP */}
          <div className="md:col-span-2 p-6 rounded-3xl bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#c1c1c1]/30 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-manga text-xl tracking-wider">SYNC PC & MOBILE</h3>
              <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] mt-1">
                Ekspor koleksi bookmark & riwayat baca dari PC ke HP (atau sebaliknya) menggunakan file JSON.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleExport}
                className="px-5 py-3 rounded-xl bg-[#f9cb55] text-[#121212] font-manga text-xs tracking-wider flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                EXPORT BACKUP
              </button>

              <label className="px-5 py-3 rounded-xl bg-[#ececec] dark:bg-[#252525] text-[#121212] dark:text-[#f8f8f8] font-manga text-xs tracking-wider flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                IMPORT JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

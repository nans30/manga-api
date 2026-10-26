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
  const [syncMessage, setSyncMessage] = useState('');
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [defaultReaderMode, setDefaultReaderMode] = useState<ReaderViewMode>(() =>
    getSavedReaderMode()
  );

  useEffect(() => {
    if (activeTabParam === 'profile') setTab('profile');
    else if (activeTabParam === 'history') setTab('history');
    else setTab('bookmarks');
  }, [activeTabParam]);

  const refreshData = () => {
    setBookmarks(getBookmarks());
    setHistory(getReadingHistory());
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

  const handleThemeChange = (next: ThemeMode) => {
    setThemeState(next);
    setTheme(next);
  };

  const handleReaderModePref = (next: ReaderViewMode) => {
    setDefaultReaderMode(next);
    setSavedReaderMode(next);
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

      {syncMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#f9cb55]/20 border border-[#f9cb55] text-[#121212] dark:text-[#f9cb55] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {syncMessage}
        </div>
      )}

      {/* TAB 1: SAVED BOOKMARKS */}
      {tab === 'bookmarks' && (
        <>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bookmarks.map((manga) => (
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
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        <Star className="w-3.5 h-3.5 fill-current text-[#f9cb55]" />
                        5.0
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#f9cb55] text-[#121212] font-extrabold text-[10px]">
                        SAVED
                      </span>
                    </div>
                    <p className="text-xs text-[#6e6e6e] dark:text-[#c1c1c1] line-clamp-2 mt-2">
                      {getMangaDescription(manga, sysLang)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
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

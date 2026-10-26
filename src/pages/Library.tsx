import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Manga, ReadingHistoryItem } from '../types';
import { MangaCard } from '../components/MangaCard';
import {
  getBookmarks,
  getReadingHistory,
  clearReadingHistory,
  exportLibraryData,
  importLibraryData,
} from '../storage';
import {
  Bookmark,
  Clock,
  Trash2,
  Download,
  Upload,
  Play,
  CheckCircle2,
} from 'lucide-react';

export const Library: React.FC = () => {
  const [tab, setTab] = useState<'bookmarks' | 'history'>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Manga[]>([]);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [syncMessage, setSyncMessage] = useState('');

  const refreshData = () => {
    setBookmarks(getBookmarks());
    setHistory(getReadingHistory());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleExport = () => {
    const dataStr = exportLibraryData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciaran-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSyncMessage('Backup berhasil diunduh!');
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
        setSyncMessage('Data koleksi & riwayat berhasil dipulihkan!');
      } else {
        setSyncMessage('Format file backup tidak valid.');
      }
      setTimeout(() => setSyncMessage(''), 3500);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-6">
      {/* Header & Backup/Sync PC <-> HP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Koleksi & Riwayat Baca</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Tersimpan otomatis di perangkat ini. Gunakan fitur Export/Import untuk memindahkan koleksi antara PC dan HP.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 border border-zinc-700"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            Backup JSON
          </button>

          <label className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 border border-zinc-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Restore JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {syncMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          {syncMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('bookmarks')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              tab === 'bookmarks'
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Bookmark ({bookmarks.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              tab === 'history'
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Riwayat Baca ({history.length})
          </button>
        </div>

        {tab === 'history' && history.length > 0 && (
          <button
            onClick={() => {
              clearReadingHistory();
              refreshData();
            }}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Riwayat
          </button>
        )}
      </div>

      {/* Tab Content */}
      {tab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-3">
            <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-300 font-semibold">Belum ada komik yang disimpan</p>
            <p className="text-xs text-zinc-500">
              Klik tombol "Simpan Bookmark" pada halaman detail komik favoritmu.
            </p>
            <Link
              to="/"
              className="inline-block px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
            >
              Jelajahi Manga
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {bookmarks.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-3">
          <Clock className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-semibold">Belum ada riwayat baca</p>
          <p className="text-xs text-zinc-500">
            Komik yang kamu baca akan otomatis muncul di sini agar mudah dilanjutkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {history.map((item) => (
            <div
              key={`${item.mangaId}-${item.chapterId}`}
              className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-orange-500/40 transition-all"
            >
              <Link
                to={`/manga/${item.mangaId}`}
                className="flex items-center gap-3.5 min-w-0 flex-1"
              >
                <img
                  src={item.coverUrl}
                  alt={item.mangaTitle}
                  className="w-14 h-20 object-cover rounded-xl shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate hover:text-orange-400">
                    {item.mangaTitle}
                  </h3>
                  <p className="text-xs text-orange-400 font-semibold mt-1">
                    Terakhir dibaca: Chapter {item.chapterNumber} (
                    {item.language.toUpperCase()})
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {new Date(item.readAt).toLocaleString('id-ID')}
                  </p>
                </div>
              </Link>

              <Link
                to={`/read/${item.chapterId}?mangaId=${item.mangaId}&lang=${item.language}`}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-lg shadow-orange-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Lanjut
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Manga, Chapter } from '../types';
import { isBookmarked, toggleBookmark, getReadChapters } from '../storage';
import {
  Bookmark,
  BookmarkCheck,
  Star,
  Users,
  BookOpen,
  Globe,
  ArrowLeft,
  Play,
  Calendar,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';

export const MangaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [langFilter, setLangFilter] = useState<'all' | 'id' | 'en'>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setReadIds(getReadChapters());

    fetch(`/api/manga/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setManga(json.data);
          setBookmarked(isBookmarked(json.data.id));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setChaptersLoading(true);

    fetch(`/api/manga/${id}/chapters?lang=${langFilter}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setChapters(json.data);
        }
      })
      .catch(console.error)
      .finally(() => setChaptersLoading(false));
  }, [id, langFilter]);

  const handleToggleBookmark = () => {
    if (!manga) return;
    const next = toggleBookmark(manga);
    setBookmarked(next);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6 animate-pulse">
        <div className="h-64 bg-zinc-900 rounded-2xl" />
        <div className="h-96 bg-zinc-900 rounded-2xl" />
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-xl font-bold text-zinc-200">Manga tidak ditemukan</p>
        <Link to="/" className="inline-block px-4 py-2 rounded-xl bg-orange-500 text-white text-sm">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const displayedChapters = sortAsc ? [...chapters].reverse() : chapters;
  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const latestChapter = chapters.length > 0 ? chapters[0] : null;

  return (
    <div className="pb-24 md:pb-16">
      {/* Blurred Header Backdrop */}
      <div className="relative overflow-hidden border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="absolute inset-0">
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover opacity-20 blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-950/60" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white mb-6 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
            {/* Cover Image */}
            <img
              src={manga.coverUrl}
              alt={manga.title}
              className="w-48 sm:w-56 aspect-[3/4.2] object-cover rounded-2xl shadow-2xl border border-zinc-700/80 shrink-0"
            />

            {/* Details */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-orange-500 text-white">
                    {manga.status}
                  </span>
                  {manga.year && (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300">
                      {manga.year}
                    </span>
                  )}
                  {manga.rating && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {manga.rating}
                    </span>
                  )}
                  {manga.follows ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300">
                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                      {manga.follows.toLocaleString()}
                    </span>
                  ) : null}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  {manga.title}
                </h1>
                {manga.altTitle && (
                  <p className="text-sm text-zinc-400 font-medium">{manga.altTitle}</p>
                )}
              </div>

              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Author:</span>{' '}
                <span className="font-medium text-zinc-200">{manga.author}</span>
                {manga.artist && manga.artist !== manga.author && (
                  <>
                    {' '}
                    • <span className="text-zinc-500">Artist:</span>{' '}
                    <span className="font-medium text-zinc-200">{manga.artist}</span>
                  </>
                )}
              </p>

              {/* Genre Tags */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                {manga.tags.map((t) => (
                  <Link
                    key={t.id}
                    to={`/?tag=${t.id}`}
                    className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>

              {/* Synopsis */}
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl whitespace-pre-line line-clamp-5 hover:line-clamp-none transition-all">
                {manga.description}
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                {firstChapter && (
                  <Link
                    to={`/read/${firstChapter.id}?mangaId=${manga.id}&lang=${langFilter}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Baca Ch. Awal ({firstChapter.chapter})
                  </Link>
                )}

                {latestChapter && latestChapter.id !== firstChapter?.id && (
                  <Link
                    to={`/read/${latestChapter.id}?mangaId=${manga.id}&lang=${langFilter}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm border border-zinc-700 transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-orange-400" />
                    Ch. Terbaru ({latestChapter.chapter})
                  </Link>
                )}

                <button
                  onClick={handleToggleBookmark}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all ${
                    bookmarked
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  }`}
                >
                  {bookmarked ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      Tersimpan di Koleksi
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      Simpan Bookmark
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters List Section */}
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 border border-zinc-800/80 p-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">
              Daftar Chapter ({chapters.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setLangFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  langFilter === 'all'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                ID + EN
              </button>
              <button
                onClick={() => setLangFilter('id')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  langFilter === 'id'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🇮🇩 Indonesia
              </button>
              <button
                onClick={() => setLangFilter('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  langFilter === 'en'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🇬🇧 English
              </button>
            </div>

            {/* Sort Order Toggle */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-400" />
              {sortAsc ? 'Terlama → Terbaru' : 'Terbaru → Terlama'}
            </button>
          </div>
        </div>

        {/* Chapters Items */}
        {chaptersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : displayedChapters.length === 0 ? (
          <div className="text-center py-14 bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-2">
            <p className="text-zinc-300 font-semibold">
              Belum ada chapter untuk filter bahasa ini.
            </p>
            {langFilter !== 'all' && (
              <button
                onClick={() => setLangFilter('all')}
                className="text-xs text-orange-400 hover:underline"
              >
                Tampilkan Semua Bahasa (ID & EN)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {displayedChapters.map((ch) => {
              const isRead = readIds.includes(ch.id);
              return (
                <Link
                  key={ch.id}
                  to={`/read/${ch.id}?mangaId=${manga.id}&lang=${langFilter}`}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all group ${
                    isRead
                      ? 'bg-zinc-900/30 border-zinc-800/50 text-zinc-500'
                      : 'bg-zinc-900/80 border-zinc-800/90 hover:border-orange-500/60 text-zinc-100'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-semibold">
                        {ch.translatedLanguage === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
                      </span>
                      <span className="font-bold text-sm group-hover:text-orange-400 transition-colors">
                        Chapter {ch.chapter}
                      </span>
                      {isRead && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {ch.title && (
                      <p className="text-xs text-zinc-400 truncate mt-1">{ch.title}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                      <span className="truncate max-w-[160px]">{ch.groupName}</span>
                      <span>•</span>
                      <span>{ch.pages} hal</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(ch.publishAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

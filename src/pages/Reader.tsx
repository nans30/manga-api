import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Chapter, ChapterPage } from '../types';
import { addReadingHistory } from '../storage';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Rows,
  Square,
  Maximize2,
  Loader2,
  Home,
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

  // Reader settings
  const [mode, setMode] = useState<'webtoon' | 'single'>('webtoon');
  const [quality, setQuality] = useState<'data-saver' | 'data'>('data-saver');
  const [fitWidth, setFitWidth] = useState<'normal' | 'wide' | 'full'>('normal');
  const [currentPage, setCurrentPage] = useState(0);
  const [hudVisible, setHudVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          setPages(json.pages || []);
          setChapterMeta(json.chapter || null);

          // Save to reading history
          const mId = json.chapter?.mangaId || mangaIdParam;
          if (mId) {
            fetch(`/api/manga/${mId}`)
              .then((r) => r.json())
              .then((mJson) => {
                if (mJson.data) {
                  addReadingHistory({
                    mangaId: mId,
                    mangaTitle: mJson.data.title,
                    coverUrl: mJson.data.coverUrl,
                    chapterId: chapterId,
                    chapterNumber: json.chapter?.chapter || '?',
                    chapterTitle: json.chapter?.title || '',
                    language: json.chapter?.translatedLanguage || 'en',
                    readAt: new Date().toISOString(),
                  });
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => setError(err.message || 'Gagal memuat halaman'))
      .finally(() => setLoading(false));
  }, [chapterId, quality, mangaIdParam]);

  // Load sibling chapters for Prev / Next buttons
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

  // Find previous & next chapter (chapterList is ordered desc: newest first)
  const currentIndex = chapterList.findIndex((c) => c.id === chapterId);
  const nextChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const prevChapter =
    currentIndex >= 0 && currentIndex < chapterList.length - 1
      ? chapterList[currentIndex + 1]
      : null;

  // Keyboard navigation for PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'single') {
        if (e.key === 'ArrowRight') {
          if (currentPage < pages.length - 1) {
            setCurrentPage((p) => p + 1);
            window.scrollTo({ top: 0 });
          } else if (nextChapter) {
            navigate(
              `/read/${nextChapter.id}?mangaId=${chapterMeta?.mangaId || mangaIdParam}&lang=${langParam}`
            );
          }
        } else if (e.key === 'ArrowLeft') {
          if (currentPage > 0) {
            setCurrentPage((p) => p - 1);
            window.scrollTo({ top: 0 });
          } else if (prevChapter) {
            navigate(
              `/read/${prevChapter.id}?mangaId=${chapterMeta?.mangaId || mangaIdParam}&lang=${langParam}`
            );
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, currentPage, pages.length, nextChapter, prevChapter, navigate, chapterMeta, mangaIdParam, langParam]);

  const activeMangaId = chapterMeta?.mangaId || mangaIdParam;

  const containerWidthClass =
    fitWidth === 'normal'
      ? 'max-w-3xl'
      : fitWidth === 'wide'
      ? 'max-w-5xl'
      : 'max-w-full';

  return (
    <div className="min-h-screen bg-black text-zinc-100 select-none relative">
      {/* Top Floating HUD */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 transition-transform duration-300 ${
          hudVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 shrink-0"
              title="Kembali ke Detail Manga"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate">
                {chapterMeta?.mangaTitle || 'Membaca Manga'}
              </h1>
              <p className="text-[11px] text-orange-400 font-medium truncate">
                Chapter {chapterMeta?.chapter || '...'}{' '}
                {chapterMeta?.title ? `— ${chapterMeta.title}` : ''}
              </p>
            </div>
          </div>

          {/* Chapter Selector & Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {chapterList.length > 0 && (
              <select
                value={chapterId}
                onChange={(e) =>
                  navigate(
                    `/read/${e.target.value}?mangaId=${activeMangaId}&lang=${langParam}`
                  )
                }
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 max-w-[130px] sm:max-w-[180px] focus:outline-none focus:border-orange-500"
              >
                {chapterList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch. {ch.chapter} ({ch.translatedLanguage.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                settingsOpen
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Pengaturan Baca"
            >
              <Settings className="w-4 h-4" />
            </button>

            <Link
              to="/"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hidden sm:inline-flex"
              title="Ke Beranda"
            >
              <Home className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Settings Dropdown Drawer */}
        {settingsOpen && (
          <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
              {/* Reading Mode */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-medium">Mode Baca:</span>
                <button
                  onClick={() => setMode('webtoon')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold ${
                    mode === 'webtoon'
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  <Rows className="w-3.5 h-3.5" />
                  Vertikal (Webtoon)
                </button>
                <button
                  onClick={() => setMode('single')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold ${
                    mode === 'single'
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  Per Halaman
                </button>
              </div>

              {/* Image Quality */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-medium">Kualitas:</span>
                <button
                  onClick={() => setQuality('data-saver')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                    quality === 'data-saver'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  Hemat Kuota (Cepat)
                </button>
                <button
                  onClick={() => setQuality('data')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                    quality === 'data'
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  HD Original
                </button>
              </div>

              {/* Width Fit (PC) */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-zinc-400 font-medium">Lebar Gambar:</span>
                <button
                  onClick={() =>
                    setFitWidth(
                      fitWidth === 'normal'
                        ? 'wide'
                        : fitWidth === 'wide'
                        ? 'full'
                        : 'normal'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center gap-1.5 font-semibold"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-orange-400" />
                  {fitWidth === 'normal'
                    ? 'Standar (Ideal)'
                    : fitWidth === 'wide'
                    ? 'Lebar'
                    : 'Layar Penuh'}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Reader Canvas */}
      <main
        onClick={() => {
          if (mode === 'webtoon') setHudVisible((v) => !v);
        }}
        className={`mx-auto ${containerWidthClass} pt-14 pb-24 min-h-screen flex flex-col items-center justify-center`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-sm text-zinc-400">Memuat halaman komik dari MangaDex...</p>
          </div>
        ) : error ? (
          <div className="text-center py-24 px-4 space-y-4">
            <p className="text-red-400 font-semibold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold"
            >
              Coba Muat Ulang
            </button>
          </div>
        ) : mode === 'webtoon' ? (
          /* Vertical Long-Strip Mode (Best for HP & Smooth PC Scroll) */
          <div className="w-full flex flex-col items-center">
            {pages.map((p) => (
              <img
                key={p.index}
                src={p.url}
                alt={`Halaman ${p.index}`}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== p.rawUrl) {
                    target.src = p.rawUrl;
                  }
                }}
                className="w-full h-auto block bg-zinc-950"
              />
            ))}
          </div>
        ) : (
          /* Single Page Mode (Tap Left/Right to flip) */
          <div className="w-full relative flex flex-col items-center">
            {pages[currentPage] && (
              <div className="relative w-full flex justify-center">
                <img
                  src={pages[currentPage].url}
                  alt={`Halaman ${currentPage + 1}`}
                  className="max-h-[88vh] w-auto object-contain mx-auto"
                />
                {/* Left Tap Zone */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentPage > 0) {
                      setCurrentPage((p) => p - 1);
                      window.scrollTo({ top: 0 });
                    }
                  }}
                  className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
                  title="Halaman Sebelumnya"
                />
                {/* Center Tap Zone (Toggle HUD) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setHudVisible((v) => !v);
                  }}
                  className="absolute inset-y-0 left-1/3 w-1/3 cursor-pointer"
                />
                {/* Right Tap Zone */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentPage < pages.length - 1) {
                      setCurrentPage((p) => p + 1);
                      window.scrollTo({ top: 0 });
                    }
                  }}
                  className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
                  title="Halaman Selanjutnya"
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-4">
              <button
                disabled={currentPage <= 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold disabled:opacity-40"
              >
                ← Hal Sebelumnya
              </button>
              <span className="text-xs font-bold text-zinc-300">
                {currentPage + 1} / {pages.length}
              </span>
              <button
                disabled={currentPage >= pages.length - 1}
                onClick={() =>
                  setCurrentPage((p) => Math.min(pages.length - 1, p + 1))
                }
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold disabled:opacity-40"
              >
                Hal Selanjutnya →
              </button>
            </div>
          </div>
        )}

        {/* End of Chapter Navigation Footer */}
        {!loading && pages.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto mt-10 px-4 space-y-4"
          >
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Selesai Membaca Chapter {chapterMeta?.chapter}
              </p>
              <div className="flex items-center justify-center gap-3">
                {prevChapter ? (
                  <Link
                    to={`/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Ch. {prevChapter.chapter}
                  </Link>
                ) : (
                  <div className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 text-sm">
                    Chapter Awal
                  </div>
                )}

                {nextChapter ? (
                  <Link
                    to={`/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`}
                    className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    Lanjut Ch. {nextChapter.chapter}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    to={activeMangaId ? `/manga/${activeMangaId}` : '/'}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm"
                  >
                    Kembali ke Detail
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Floating Quick Bar */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 transition-transform duration-300 ${
          hudVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between text-xs">
          <button
            disabled={!prevChapter}
            onClick={() =>
              prevChapter &&
              navigate(
                `/read/${prevChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`
              )
            }
            className="flex items-center gap-1 text-zinc-300 hover:text-orange-400 disabled:opacity-30 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            {prevChapter ? `Ch. ${prevChapter.chapter}` : 'Awal'}
          </button>

          <span className="text-zinc-400 font-medium">
            {mode === 'webtoon'
              ? `${pages.length} Halaman • Ketuk layar untuk sembunyikan menu`
              : `Halaman ${currentPage + 1} dari ${pages.length}`}
          </span>

          <button
            disabled={!nextChapter}
            onClick={() =>
              nextChapter &&
              navigate(
                `/read/${nextChapter.id}?mangaId=${activeMangaId}&lang=${langParam}`
              )
            }
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 disabled:opacity-30 font-semibold"
          >
            {nextChapter ? `Ch. ${nextChapter.chapter}` : 'Terbaru'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

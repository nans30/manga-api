import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Manga, MangaTag, ReadingHistoryItem } from '../types';
import { MangaCard } from '../components/MangaCard';
import { getReadingHistory } from '../storage';
import scrapedCache from '../data/mangadex-cache.json';
import {
  RefreshCw,
  Flame,
  Sparkles,
  Star,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Play,
  Radio,
} from 'lucide-react';

export const Home: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const selectedTag = searchParams.get('tag') || '';
  const statusFilter = searchParams.get('status') || '';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const getInitialCachedList = (sortKey: string): Manga[] => {
    const cache: any = scrapedCache;
    if (sortKey === 'popular') return cache.popular || [];
    if (sortKey === 'rating') return cache.rating || [];
    return cache.latest || [];
  };

  const [mangaList, setMangaList] = useState<Manga[]>(() => getInitialCachedList(sort));
  const [tags, setTags] = useState<MangaTag[]>(() =>
    ((scrapedCache as any).tags || []).slice(0, 24)
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(
    () => new Date((scrapedCache as any).scrapedAt || Date.now())
  );
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [total, setTotal] = useState(10000);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);

  const LIMIT = 24;

  const fetchManga = useCallback(
    async (silent = false) => {
      const isDefaultView = !query && !selectedTag && !statusFilter && page === 1;
      if (isDefaultView && !silent) {
        const cached = getInitialCachedList(sort);
        if (cached.length > 0) {
          setMangaList(cached);
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      } else if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('sort', sort);
        if (selectedTag) params.set('tag', selectedTag);
        if (statusFilter) params.set('status', statusFilter);
        params.set('limit', String(LIMIT));
        params.set('offset', String((page - 1) * LIMIT));

        const res = await fetch(`/api/manga?${params.toString()}`);
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setMangaList(json.data);
          setTotal(Math.min(json.total || 10000, 10000));
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to load live manga, using scraped cache:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, sort, selectedTag, statusFilter, page]
  );

  useEffect(() => {
    fetchManga(false);
    setHistory(getReadingHistory().slice(0, 6));
  }, [fetchManga]);

  // Fetch genre tags once
  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((json) => {
        if (json.data && json.data.length > 0) setTags(json.data.slice(0, 24));
      })
      .catch(() => {});
  }, []);

  // Auto-refresh every 60 seconds when on Latest tab
  useEffect(() => {
    if (!autoRefresh || sort !== 'latest' || page !== 1) return;
    const timer = setInterval(() => {
      fetchManga(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [autoRefresh, sort, page, fetchManga]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const featured = mangaList[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-8">
      {/* Hero Banner on Main Page */}
      {!query && page === 1 && featured && !loading && (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="absolute inset-0">
            <img
              src={featured.coverUrl}
              alt={featured.title}
              className="w-full h-full object-cover opacity-20 blur-xl scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-zinc-950/60" />
          </div>

          <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <img
              src={featured.coverUrl}
              alt={featured.title}
              className="w-36 sm:w-44 aspect-[3/4.2] object-cover rounded-xl shadow-2xl border border-zinc-700/80 shrink-0"
            />
            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Spotlight MangaDex</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight line-clamp-2">
                {featured.title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl line-clamp-3 leading-relaxed">
                {featured.description}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                {featured.tags.slice(0, 4).map((t) => (
                  <span
                    key={t.id}
                    className="text-xs px-2.5 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <div className="pt-3 flex items-center justify-center md:justify-start gap-3">
                <Link
                  to={`/manga/${featured.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Baca Sekarang
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continue Reading Bar (If User Has History) */}
      {!query && page === 1 && history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Lanjutkan Membaca
            </h2>
            <Link to="/library" className="text-xs text-orange-400 hover:underline">
              Lihat Semua →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.slice(0, 3).map((item) => (
              <Link
                key={item.mangaId}
                to={`/read/${item.chapterId}?mangaId=${item.mangaId}&lang=${item.language}`}
                className="flex items-center gap-3.5 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-orange-500/50 transition-all group"
              >
                <img
                  src={item.coverUrl}
                  alt={item.mangaTitle}
                  className="w-12 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-orange-400">
                    {item.mangaTitle}
                  </h4>
                  <p className="text-xs text-orange-400 font-medium mt-0.5">
                    Lanjut Ch. {item.chapterNumber} ({item.language.toUpperCase()})
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {new Date(item.readAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <Play className="w-4 h-4 fill-current" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Controls & Filter Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => updateParam('sort', 'latest')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                sort === 'latest'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Update Terbaru
            </button>
            <button
              onClick={() => updateParam('sort', 'popular')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                sort === 'popular'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Flame className="w-4 h-4" />
              Populer
            </button>
            <button
              onClick={() => updateParam('sort', 'rating')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                sort === 'rating'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Star className="w-4 h-4" />
              Rating Tertinggi
            </button>
          </div>

          {/* Live Sync Indicator & Manual Refresh */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
              title="Update otomatis setiap 60 detik dari MangaDex"
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>{autoRefresh ? 'Live Sync ON' : 'Live Sync OFF'}</span>
            </button>

            <button
              onClick={() => fetchManga(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
              <span>
                {lastUpdated.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </button>
          </div>
        </div>

        {/* Genre & Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-orange-400" />
            Filter:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => updateParam('status', e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 shrink-0"
          >
            <option value="">Semua Status</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>

          <button
            onClick={() => updateParam('tag', '')}
            className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
              !selectedTag
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Semua Genre
          </button>

          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => updateParam('tag', selectedTag === t.id ? '' : t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                selectedTag === t.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search Heading if active */}
      {query && (
        <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 px-4 py-3 rounded-xl">
          <p className="text-sm text-zinc-300">
            Hasil pencarian untuk: <span className="font-bold text-orange-400">"{query}"</span>
          </p>
          <button
            onClick={() => updateParam('q', '')}
            className="text-xs text-zinc-400 hover:text-white underline"
          >
            Reset Pencarian
          </button>
        </div>
      )}

      {/* Manga Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4.5] rounded-xl bg-zinc-900/90 border border-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : mangaList.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800">
          <p className="text-lg font-semibold text-zinc-300">Tidak ada komik yang ditemukan</p>
          <p className="text-sm text-zinc-500 mt-1">
            Coba kata kunci lain atau hapus filter pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {mangaList.map((manga) => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && mangaList.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => updateParam('page', String(page - 1))}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-200 disabled:opacity-40 hover:border-orange-500 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Sebelumnya
          </button>
          <span className="text-sm font-semibold text-zinc-400 px-3">
            Halaman <span className="text-white">{page}</span> dari{' '}
            {Math.max(1, Math.ceil(total / LIMIT))}
          </span>
          <button
            disabled={page * LIMIT >= total}
            onClick={() => updateParam('page', String(page + 1))}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-200 disabled:opacity-40 hover:border-orange-500 flex items-center gap-1"
          >
            Selanjutnya
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

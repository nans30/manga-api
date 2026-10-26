import React from 'react';
import { Link } from 'react-router-dom';
import { Manga } from '../types';
import { BookOpen, Clock } from 'lucide-react';

interface MangaCardProps {
  manga: Manga;
}

export const MangaCard: React.FC<MangaCardProps> = ({ manga }) => {
  const statusColor =
    manga.status === 'ongoing'
      ? 'bg-emerald-500/90 text-white'
      : manga.status === 'completed'
      ? 'bg-sky-500/90 text-white'
      : 'bg-amber-500/90 text-white';

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return 'Baru saja';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins}m lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j lalu`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}h lalu`;
    return new Date(iso).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
  };

  return (
    <Link
      to={`/manga/${manga.id}`}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-zinc-900/70 border border-zinc-800/80 hover:border-orange-500/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10"
    >
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-zinc-800">
        <img
          src={manga.coverUrl}
          alt={manga.title}
          loading="lazy"
          className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />

        {/* Status badge */}
        <span
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md backdrop-blur-md ${statusColor}`}
        >
          {manga.status}
        </span>

        {/* Origin badge */}
        <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-zinc-950/80 text-zinc-200 border border-zinc-700/60 backdrop-blur-md">
          {manga.originalLanguage === 'ja'
            ? '🇯🇵 Manga'
            : manga.originalLanguage === 'ko'
            ? '🇰🇷 Manhwa'
            : manga.originalLanguage === 'zh'
            ? '🇨🇳 Manhua'
            : manga.originalLanguage.toUpperCase()}
        </span>

        {/* Bottom overlay info */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-zinc-300 font-medium">
          <span className="flex items-center gap-1 bg-zinc-950/75 px-2 py-0.5 rounded-md backdrop-blur-sm">
            <BookOpen className="w-3 h-3 text-orange-400" />
            {manga.lastChapter ? `Ch. ${manga.lastChapter}` : 'Baca'}
          </span>
          {manga.updatedAt && (
            <span className="flex items-center gap-1 bg-zinc-950/75 px-1.5 py-0.5 rounded-md backdrop-blur-sm text-zinc-400">
              <Clock className="w-3 h-3 text-orange-400" />
              {formatRelativeTime(manga.updatedAt)}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug">
            {manga.title}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{manga.author}</p>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {manga.tags.slice(0, 2).map((t) => (
            <span
              key={t.id}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700/50"
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
};

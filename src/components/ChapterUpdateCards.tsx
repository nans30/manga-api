import React from 'react';
import { Link } from 'react-router-dom';
import { Manga } from '../types';
import { formatRelativeTime } from './MangaCard';
import { getMangaDescription } from '../storage';
import { BookOpen } from 'lucide-react';

interface CardProps {
  manga: Manga;
  sysLang?: 'id' | 'en';
}

function getFlagEmoji(originalLanguage: string): string {
  if (originalLanguage === 'ko') return '🇰🇷';
  if (originalLanguage === 'zh') return '🇨🇳';
  return '🇯🇵';
}

function getComicTypeName(manga: Manga): string {
  if (manga.comicType) return manga.comicType;
  if (manga.originalLanguage === 'ko') return 'Manhwa';
  if (manga.originalLanguage === 'zh') return 'Manhua';
  return 'Manga';
}

function getPrimaryGenre(manga: Manga): string {
  if (manga.primaryGenre) return manga.primaryGenre;
  if (manga.tags && manga.tags.length > 0) {
    return manga.tags[0].name;
  }
  return 'Manga';
}

/**
 * GAMBAR 1 MATCH:
 * Vertical Grid Card with flag, title, "Genre · relative time", and wide "Chapter X.X" action button.
 */
export const MangaUpdateGridCard: React.FC<CardProps> = ({ manga }) => {
  const flag = getFlagEmoji(manga.originalLanguage);
  const genre = getPrimaryGenre(manga);
  const timeAgo = formatRelativeTime(manga.updatedAt);
  const detailLink = `/manga/${manga.id}`;
  const chapterNumber = manga.lastChapter || 'Baru';
  const chapterLink = manga.lastChapterId
    ? `/read/${manga.lastChapterId}?mangaId=${manga.id}`
    : detailLink;

  return (
    <div className="group flex flex-col justify-between bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Thumbnail area */}
      <Link
        to={detailLink}
        state={{ manga }}
        className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 block"
      >
        <img
          src={manga.coverUrl}
          alt={manga.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Up badge top left (if any) */}
        {manga.badgeUp && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[10px] tracking-wider shadow-md">
            {manga.badgeUp}
          </span>
        )}

        {/* Origin country flag top right (Photo 1 Match: Japan flag badge) */}
        <span
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-black/75 shadow-sm text-sm border border-black/10 dark:border-white/10"
          title={getComicTypeName(manga)}
        >
          {flag}
        </span>
      </Link>

      {/* Info & Action area */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
        <div>
          <Link
            to={detailLink}
            state={{ manga }}
            className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-[#f9cb55] transition-colors line-clamp-1 leading-snug"
            title={manga.title}
          >
            {manga.title}
          </Link>

          {/* Subtitle: "Slice of Life · 34 menit lalu" (Photo 1 Match) */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
            {genre} <span className="mx-0.5 opacity-60">·</span> {timeAgo}
          </p>
        </div>

        {/* Action Button: Wide gray button "Chapter X.X" (Photo 1 Match) */}
        <Link
          to={chapterLink}
          state={{ manga }}
          className="w-full py-2 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition-colors text-center border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm flex items-center justify-center gap-1.5"
          title={`Baca Chapter ${chapterNumber}`}
        >
          <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Chapter {chapterNumber}</span>
        </Link>
      </div>
    </div>
  );
};

/**
 * GAMBAR 2 MATCH:
 * Horizontal List Card with Landscape Cover, "UP 6" badge, "Manga Romantis" bottom overlay,
 * Title, "Romantis • 29 menit", Synopsis, and two buttons "Awal: Chapter 01" & "Terbaru: Chapter 9".
 */
export const MangaUpdateListCard: React.FC<CardProps> = ({ manga, sysLang = 'id' }) => {
  const comicType = getComicTypeName(manga);
  const genre = getPrimaryGenre(manga);
  const timeAgo = formatRelativeTime(manga.updatedAt);
  const detailLink = `/manga/${manga.id}`;
  const synopsis = getMangaDescription(manga, sysLang);

  // Cover: prefer horizontal cover if available, otherwise coverUrl
  const coverSrc = manga.coverHorizontalUrl || manga.coverUrl;

  const firstChText = manga.firstChapter ? `Chapter ${manga.firstChapter}` : 'Chapter 01';
  const firstChLink = manga.firstChapterId
    ? `/read/${manga.firstChapterId}?mangaId=${manga.id}`
    : detailLink;

  const lastChText = manga.lastChapter ? `Chapter ${manga.lastChapter}` : 'Chapter Terbaru';
  const lastChLink = manga.lastChapterId
    ? `/read/${manga.lastChapterId}?mangaId=${manga.id}`
    : detailLink;

  return (
    <div className="group flex flex-col sm:flex-row items-stretch bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all p-3 sm:p-4 gap-3.5 sm:gap-4">
      {/* Left Thumbnail (Landscape) */}
      <Link
        to={detailLink}
        state={{ manga }}
        className="relative w-full sm:w-48 md:w-56 aspect-[16/10] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0 shadow-sm"
      >
        <img
          src={coverSrc}
          alt={manga.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top-left Blue UP badge (Photo 2 Match: "UP 6") */}
        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[11px] tracking-wider shadow-md">
          {manga.badgeUp || 'UP'}
        </span>

        {/* Bottom-right Overlay: "Manga Romantis" (Photo 2 Match) */}
        <span className="absolute bottom-2 right-2.5 text-white font-bold text-xs drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
          {comicType} {genre}
        </span>
      </Link>

      {/* Right Column: Title, Subtitle, Synopsis, Chapter Buttons */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5">
        <div>
          {/* Title */}
          <Link
            to={detailLink}
            state={{ manga }}
            className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 group-hover:text-[#f9cb55] transition-colors line-clamp-1 leading-snug"
            title={manga.title}
          >
            {manga.title}
          </Link>

          {/* Subtitle: "Romantis • 29 menit" (Photo 2 Match) */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            {genre} <span className="mx-1">•</span> {timeAgo}
          </p>

          {/* Synopsis short preview (Photo 2 Match) */}
          <p className="text-xs text-zinc-600 dark:text-zinc-300/90 line-clamp-2 mt-1.5 leading-relaxed">
            {synopsis || `Baca kisah lengkap ${manga.title} chapter terbaru di Ciaran.`}
          </p>
        </div>

        {/* Bottom Two Buttons: "Awal: Chapter 01" & "Terbaru: Chapter 9" (Photo 2 Match) */}
        <div className="flex items-center gap-2.5 flex-wrap pt-1">
          {/* Button Awal */}
          <Link
            to={firstChLink}
            state={{ manga }}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
            title={`Baca awal: ${firstChText}`}
          >
            Awal: <strong className="font-bold text-zinc-900 dark:text-white ml-0.5">{firstChText}</strong>
          </Link>

          {/* Button Terbaru */}
          <Link
            to={lastChLink}
            state={{ manga }}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
            title={`Baca terbaru: ${lastChText}`}
          >
            Terbaru: <strong className="font-bold text-zinc-900 dark:text-white ml-0.5">{lastChText}</strong>
          </Link>
        </div>
      </div>
    </div>
  );
};


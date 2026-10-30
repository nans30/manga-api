export type MangaSource = 'mangadex' | 'komiku' | 'komikindo';

export interface MangaTag {
  id: string;
  name: string;
  group: string;
}

export interface Manga {
  id: string;
  title: string;
  altTitle?: string;
  description: string;
  descriptionId?: string;
  descriptionEn?: string;
  status: string;
  year: number | null;
  contentRating: string;
  originalLanguage: string;
  lastChapter: string | null;
  lastChapterId?: string | null;
  updatedAt: string | null;
  coverUrl: string;
  coverUrlFull?: string;
  author: string;
  authorId?: string;
  artist: string;
  artistId?: string;
  tags: MangaTag[];
  rating?: string | null;
  follows?: number | null;
  source?: MangaSource;
}

export interface Chapter {
  id: string;
  chapter: string;
  volume: string | null;
  title: string;
  translatedLanguage: string;
  pages: number;
  publishAt: string;
  groupName: string;
  source?: MangaSource;
  alternateId?: string;
  availableSources?: Array<MangaSource>;
}

export interface ChapterPage {
  index: number;
  url: string;
  rawUrl: string;
}

export interface ReadingHistoryItem {
  mangaId: string;
  mangaTitle: string;
  author?: string;
  coverUrl: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  currentPage?: number;
  totalPages?: number;
  progressPercent?: number;
  readAt: string;
}

import { Manga, ReadingHistoryItem } from './types';

const BOOKMARKS_KEY = 'ciaran_bookmarks_v1';
const HISTORY_KEY = 'ciaran_history_v1';
const READ_CHAPTERS_KEY = 'ciaran_read_chapters_v1';
const THEME_KEY = 'ciaran_theme_v1';
const READER_MODE_KEY = 'ciaran_reader_mode_v1';

export type ThemeMode = 'dark' | 'light';
export type ReaderViewMode = 'scroll' | 'tap';

export function getTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

export function setTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } catch {}
}

export function getSavedReaderMode(): ReaderViewMode {
  try {
    const saved = localStorage.getItem(READER_MODE_KEY);
    if (saved === 'scroll' || saved === 'tap') return saved;
  } catch {}
  return 'tap';
}

export function setSavedReaderMode(mode: ReaderViewMode) {
  try {
    localStorage.setItem(READER_MODE_KEY, mode);
  } catch {}
}

export function getBookmarks(): Manga[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isBookmarked(mangaId: string): boolean {
  return getBookmarks().some((m) => m.id === mangaId);
}

export function toggleBookmark(manga: Manga): boolean {
  const list = getBookmarks();
  const exists = list.some((m) => m.id === manga.id);
  let updated: Manga[];
  if (exists) {
    updated = list.filter((m) => m.id !== manga.id);
  } else {
    updated = [manga, ...list];
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('ciaran-storage-update'));
  return !exists;
}

export function getReadingHistory(): ReadingHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addReadingHistory(item: ReadingHistoryItem) {
  try {
    const list = getReadingHistory().filter((h) => h.mangaId !== item.mangaId);
    const updated = [item, ...list].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    markChapterAsRead(item.chapterId);
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {
    // ignore storage errors
  }
}

export function clearReadingHistory() {
  localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new Event('ciaran-storage-update'));
}

export function getReadChapters(): string[] {
  try {
    const raw = localStorage.getItem(READ_CHAPTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markChapterAsRead(chapterId: string) {
  try {
    const list = getReadChapters();
    if (!list.includes(chapterId)) {
      const updated = [chapterId, ...list].slice(0, 1000);
      localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export function exportLibraryData(): string {
  return JSON.stringify(
    {
      bookmarks: getBookmarks(),
      history: getReadingHistory(),
      readChapters: getReadChapters(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function importLibraryData(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.bookmarks)) {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(parsed.bookmarks));
    }
    if (Array.isArray(parsed.history)) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(parsed.history));
    }
    if (Array.isArray(parsed.readChapters)) {
      localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(parsed.readChapters));
    }
    window.dispatchEvent(new Event('ciaran-storage-update'));
    return true;
  } catch {
    return false;
  }
}

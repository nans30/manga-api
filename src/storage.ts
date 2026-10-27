import { useState, useEffect } from 'react';
import { Manga, ReadingHistoryItem } from './types';
import { LibraryBackupSchema } from './schemas/ciaran.schema';
import scrapedCache from './data/mangadex-cache.json';

const BOOKMARKS_KEY = 'ciaran_bookmarks_v1';
const HISTORY_KEY = 'ciaran_history_v1';
const READ_CHAPTERS_KEY = 'ciaran_read_chapters_v1';
const THEME_KEY = 'ciaran_theme_v1';
const READER_MODE_KEY = 'ciaran_reader_mode_v1';
const SYS_LANG_KEY = 'ciaran_sys_lang_v1';

export type ThemeMode = 'dark' | 'light';
export type ReaderViewMode = 'scroll' | 'tap';
export type SystemLang = 'id' | 'en';

// Fast, bounded in-memory LRU cache (max 250 items, zero synchronous JSON.stringify lag!)
const MAX_MEMORY_MANGA = 250;
const memoryMangaMap = new Map<string, Manga>();

try {
  const rawCache: any = scrapedCache;
  const initialAll: Manga[] = [
    ...(rawCache.latest || []),
    ...(rawCache.popular || []),
    ...(rawCache.rating || []),
  ];
  for (const m of initialAll) {
    if (m && m.id) memoryMangaMap.set(m.id, m);
  }
} catch {}

export function cacheMangaObjects(list: Manga[]) {
  if (!Array.isArray(list)) return;
  for (const m of list) {
    if (m && m.id) {
      if (memoryMangaMap.has(m.id)) {
        memoryMangaMap.delete(m.id);
      } else if (memoryMangaMap.size >= MAX_MEMORY_MANGA) {
        const oldestKey = memoryMangaMap.keys().next().value;
        if (oldestKey !== undefined) memoryMangaMap.delete(oldestKey);
      }
      memoryMangaMap.set(m.id, m);
    }
  }
}

export function getCachedMangaById(id?: string): Manga | null {
  if (!id) return null;
  return memoryMangaMap.get(id) || null;
}

export function getMangaDescription(manga: Manga, sysLang: SystemLang): string {
  if (sysLang === 'id') {
    return (
      manga.descriptionId ||
      manga.description ||
      'Tidak ada sinopsis untuk komik ini.'
    );
  }
  return (
    manga.descriptionEn ||
    manga.description ||
    'No synopsis available for this manga.'
  );
}

export function getSysLang(): SystemLang {
  try {
    const saved = localStorage.getItem(SYS_LANG_KEY);
    if (saved === 'id' || saved === 'en') return saved;
  } catch {}
  return 'id';
}

export function setSysLang(lang: SystemLang) {
  try {
    localStorage.setItem(SYS_LANG_KEY, lang);
    window.dispatchEvent(new Event('ciaran-lang-update'));
  } catch {}
}

export function useSysLang(): [SystemLang, (next: SystemLang) => void] {
  const [lang, setLangState] = useState<SystemLang>(() => getSysLang());

  useEffect(() => {
    const onUpdate = () => setLangState(getSysLang());
    window.addEventListener('ciaran-lang-update', onUpdate);
    return () => window.removeEventListener('ciaran-lang-update', onUpdate);
  }, []);

  const updateLang = (next: SystemLang) => {
    setSysLang(next);
    setLangState(next);
  };

  return [lang, updateLang];
}

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
  try {
    const list = getBookmarks();
    const exists = list.some((m) => m.id === manga.id);
    let updated: Manga[];
    if (exists) {
      updated = list.filter((m) => m.id !== manga.id);
    } else {
      updated = [manga, ...list].slice(0, 500);
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('ciaran-storage-update'));
    return !exists;
  } catch {
    return false;
  }
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
    if (jsonStr.length > 5 * 1024 * 1024) return false;
    const rawParsed = JSON.parse(jsonStr);

    // Strict Zod schema validation (blocks Prototype Pollution, extra fields & javascript: XSS)
    const validated = LibraryBackupSchema.safeParse(rawParsed);
    if (!validated.success) {
      return false;
    }

    const { bookmarks, history, readChapters } = validated.data;
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(readChapters));

    window.dispatchEvent(new Event('ciaran-storage-update'));
    return true;
  } catch {
    return false;
  }
}

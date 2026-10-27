import { useState, useEffect } from 'react';
import { Manga, ReadingHistoryItem } from './types';
import { LibraryBackupSchema } from './schemas/ciaran.schema';
import scrapedCache from './data/mangadex-cache.json';

const BOOKMARKS_KEY = 'ciaran_bookmarks_v1';
const HISTORY_KEY = 'ciaran_history_v1';
const READ_CHAPTERS_KEY = 'ciaran_read_chapters_v1';
const THEME_KEY = 'ciaran_theme_v1';
const READER_MODE_KEY = 'ciaran_reader_mode_v1';
const READER_SPREAD_KEY = 'ciaran_reader_spread_v1';
const READER_FIT_KEY = 'ciaran_reader_fit_v1';
const READER_AUTONEXT_KEY = 'ciaran_reader_autonext_v1';
const SYS_LANG_KEY = 'ciaran_sys_lang_v1';
const RECENT_SEARCHES_KEY = 'ciaran_recent_searches_v1';
const MAX_RECENT_SEARCHES = 10;

export type ThemeMode = 'dark' | 'light';
export type ReaderViewMode = 'scroll' | 'tap';
export type ReaderSpreadMode = 'single' | 'double';
export type ReaderFitMode = 'width' | 'height';
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

export function getSavedSpreadMode(): ReaderSpreadMode {
  try {
    const saved = localStorage.getItem(READER_SPREAD_KEY);
    if (saved === 'single' || saved === 'double') return saved;
  } catch {}
  return 'single';
}

export function setSavedSpreadMode(mode: ReaderSpreadMode) {
  try {
    localStorage.setItem(READER_SPREAD_KEY, mode);
  } catch {}
}

export function getSavedFitMode(): ReaderFitMode {
  try {
    const saved = localStorage.getItem(READER_FIT_KEY);
    if (saved === 'width' || saved === 'height') return saved;
  } catch {}
  return 'width';
}

export function setSavedFitMode(mode: ReaderFitMode) {
  try {
    localStorage.setItem(READER_FIT_KEY, mode);
  } catch {}
}

export function getSavedAutoNextOnScroll(): boolean {
  try {
    const saved = localStorage.getItem(READER_AUTONEXT_KEY);
    if (saved !== null) return saved === 'true';
  } catch {}
  return true; // Enabled by default
}

export function setSavedAutoNextOnScroll(enabled: boolean) {
  try {
    localStorage.setItem(READER_AUTONEXT_KEY, String(enabled));
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
    // Capped at 35 items to avoid storage accumulation
    const updated = [item, ...list].slice(0, 35);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    markChapterAsRead(item.chapterId);
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {
    // Auto-prune on storage quota errors
    try {
      const list = getReadingHistory().slice(0, 15);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {}
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
      // Capped at 300 IDs to keep localStorage lightweight
      const updated = [chapterId, ...list].slice(0, 300);
      localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(updated));
    }
  } catch {}
}

export function getStorageUsage(): {
  bytes: number;
  readable: string;
  percent: number;
} {
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const val = localStorage.getItem(key) || '';
      totalBytes += (key.length + val.length) * 2;
    }
    const kb = totalBytes / 1024;
    const readable =
      kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
    const percent = Math.min(100, Math.round((totalBytes / (5 * 1024 * 1024)) * 100));
    return { bytes: totalBytes, readable, percent };
  } catch {
    return { bytes: 0, readable: '0 KB', percent: 0 };
  }
}

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const list = getRecentSearches().filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    list.unshift(trimmed);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES))
    );
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {}
}

export function removeRecentSearch(query: string): void {
  try {
    const list = getRecentSearches().filter(
      (item) => item.toLowerCase() !== query.toLowerCase()
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {}
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {}
}

export function clearAppCache(keepBookmarks = true): void {
  try {
    memoryMangaMap.clear();
    localStorage.removeItem(READ_CHAPTERS_KEY);
    if (!keepBookmarks) {
      localStorage.removeItem(BOOKMARKS_KEY);
    }
    localStorage.removeItem(HISTORY_KEY);
    window.dispatchEvent(new Event('ciaran-storage-update'));
  } catch {}
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

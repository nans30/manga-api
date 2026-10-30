import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from '../server/app';
import {
  MangaSchema,
  ChapterSchema,
  ChapterPageSchema,
  ReadingHistoryItemSchema,
  LibraryBackupSchema,
  MangaQueryParamsSchema,
  ProxyImageQuerySchema,
  UuidParamSchema,
} from '../src/schemas/ciaran.schema';
import { validateEnv } from '../src/config/env';
import {
  mockMangaSoloLeveling,
  mockChapterList,
  mockChapterPages,
  mockReadingHistoryItem,
} from './mocks/ciaran.mock';

// ============================================================================
// 1. UNIT TESTS: Zod Runtime Validation & Type-Safe Domain Models (Zero `any`)
// ============================================================================
describe('Unit Tests: Ciaran Runtime Schemas & Edge Cases', () => {
  it('Happy Path: validates complete Manga, Chapter, Page, and ReadingHistory mocks', () => {
    expect(MangaSchema.safeParse(mockMangaSoloLeveling).success).toBe(true);
    expect(ChapterSchema.safeParse(mockChapterList[0]).success).toBe(true);
    expect(ChapterPageSchema.safeParse(mockChapterPages[0]).success).toBe(true);
    expect(ReadingHistoryItemSchema.safeParse(mockReadingHistoryItem).success).toBe(true);
  });

  it('Edge Cases: handles null/undefined/out-of-range query parameters safely', () => {
    const parsed = MangaQueryParamsSchema.parse({
      q: '   Solo Leveling   ',
      sort: 'invalid_sort_value',
      limit: '99999', // out of range (>100)
      offset: '-50', // negative offset
      status: 'unknown_status',
    });

    expect(parsed.q).toBe('Solo Leveling');
    expect(parsed.sort).toBe('latest'); // fallback default
    expect(parsed.limit).toBe(24); // clamped/fallback default
    expect(parsed.offset).toBe(0); // clamped/fallback default
    expect(parsed.status).toBe('');
  });

  it('Security Validation: blocks XSS javascript: URLs and Prototype Pollution in LibraryBackupSchema', () => {
    const maliciousBackup = {
      bookmarks: [
        {
          ...mockMangaSoloLeveling,
          coverUrl: 'javascript:alert(document.cookie)',
        },
      ],
      history: [],
      readChapters: [],
      __proto__: { isAdmin: true },
      extraInjectedField: 'polluted',
    };

    const result = LibraryBackupSchema.safeParse(maliciousBackup);
    expect(result.success).toBe(false);
  });

  it('Security Validation: ProxyImageQuerySchema only allows HTTPS MangaDex hosts', () => {
    const valid = ProxyImageQuerySchema.safeParse({
      url: 'https://uploads.mangadex.org/covers/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/cover.jpg',
    });
    expect(valid.success).toBe(true);

    const ssrfExternal = ProxyImageQuerySchema.safeParse({
      url: 'https://evil-attacker.com/malware.svg',
    });
    expect(ssrfExternal.success).toBe(false);

    const httpDowngrade = ProxyImageQuerySchema.safeParse({
      url: 'http://uploads.mangadex.org/covers/test.jpg',
    });
    expect(httpDowngrade.success).toBe(false);
  });

  it('Environment Validation: validates valid env and throws on malformed URLs', () => {
    const validEnv = validateEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      MANGADEX_API_URL: 'https://api.mangadex.org',
    });
    expect(validEnv.PORT).toBe(8080);
    expect(validEnv.NODE_ENV).toBe('production');

    expect(() =>
      validateEnv({
        MANGADEX_API_URL: 'not-a-valid-url',
      })
    ).toThrowError(/Invalid Environment Configuration/);
  });

  it('UUID, Komiku & Komikindo ID Validator: accepts UUIDs, komiku and komikindo slugs, and rejects path traversal', () => {
    expect(UuidParamSchema.safeParse('../../etc/passwd').success).toBe(false);
    expect(UuidParamSchema.safeParse("1' OR '1'='1").success).toBe(false);
    expect(UuidParamSchema.safeParse(mockMangaSoloLeveling.id).success).toBe(true);
    expect(UuidParamSchema.safeParse('komiku:solo-leveling').success).toBe(true);
    expect(UuidParamSchema.safeParse('komiku-ch:123213-chainsaw-man-chapter-232').success).toBe(true);
    expect(UuidParamSchema.safeParse('komiku-ch:manga-ch-1%20part%2B2').success).toBe(true);
    expect(UuidParamSchema.safeParse('komikindo:solo-leveling-ragnarok').success).toBe(true);
    expect(UuidParamSchema.safeParse('komikindo-ch:solo-leveling-ragnarok-chapter-68').success).toBe(true);
  });

  it('MangaQueryParamsSchema handles source/provider filter parameters correctly', () => {
    const p1 = MangaQueryParamsSchema.parse({ source: 'komikindo' });
    expect(p1.source).toBe('komikindo');

    const p2 = MangaQueryParamsSchema.parse({ provider: 'komiku' });
    expect(p2.provider).toBe('komiku');

    const p3 = MangaQueryParamsSchema.parse({ source: 'mangadex' });
    expect(p3.source).toBe('mangadex');

    const pInvalid = MangaQueryParamsSchema.parse({ source: 'unknown-source' });
    expect(pInvalid.source).toBe('');
  });

  it('ChapterSchema accepts multi-source badges including komikindo, alternateId and availableSources', () => {
    const multiSourceCh = {
      ...mockChapterList[0],
      source: 'komikindo',
      alternateId: 'komiku-ch:slug-ch-1',
      availableSources: ['mangadex', 'komiku', 'komikindo'],
    };
    const parsed = ChapterSchema.safeParse(multiSourceCh);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBe('komikindo');
      expect(parsed.data.availableSources).toContain('komiku');
      expect(parsed.data.availableSources).toContain('mangadex');
      expect(parsed.data.availableSources).toContain('komikindo');
    }
  });
});

// ============================================================================
// 2. INTEGRATION TESTS: Express API Security & Error Handling
// ============================================================================
describe('Integration Tests: Ciaran Express API Endpoints', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/proxy-image blocks SSRF to external domains with 403', async () => {
    const res = await fetch(`${baseUrl}/api/proxy-image?url=https://google.com/logo.png`);
    expect(res.status).toBe(403);
  });

  it('GET /api/proxy-image blocks SSRF to localhost/127.0.0.1 with 403', async () => {
    const res = await fetch(`${baseUrl}/api/proxy-image?url=https://127.0.0.1:3001/api/manga`);
    expect(res.status).toBe(403);
  });

  it('GET /api/proxy-image blocks non-HTTPS downgrade with 400', async () => {
    const res = await fetch(
      `${baseUrl}/api/proxy-image?url=http://uploads.mangadex.org/covers/test.jpg`
    );
    expect(res.status).toBe(400);
  });

  it('GET /api/manga/:id rejects invalid non-UUID parameter with 400 and hardened headers', async () => {
    const res = await fetch(`${baseUrl}/api/manga/invalid-id-traversal`);
    expect(res.status).toBe(400);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(res.headers.get('x-powered-by')).toBeNull();

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('ID Manga tidak valid');
  });

  it('GET /api/manga?source=komikindo returns list from Komikindo.ch', async () => {
    const res = await fetch(`${baseUrl}/api/manga?source=komikindo&limit=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.source).toBe('https://komikindo.ch');
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0].id.startsWith('komikindo:')).toBe(true);
    }
  }, 15000);

  it('GET /api/chapter/:chapterId rejects invalid chapterId with 400', async () => {
    const res = await fetch(`${baseUrl}/api/chapter/not-a-uuid`);
    expect(res.status).toBe(400);
  });

  it('Complementing & Deduplicating Chapters: combines MangaDex (8 ch) and Komiku (16 ch) into 16 unique episodes', () => {
    // Simulate 8 MangaDex chapters (1 to 8)
    const mdChapters = Array.from({ length: 8 }, (_, i) => ({
      id: `md-ch-${i + 1}`,
      chapter: String(i + 1),
      volume: null,
      title: `Chapter ${i + 1}`,
      translatedLanguage: 'en',
      pages: 20,
      publishAt: '2026-01-01T00:00:00Z',
      groupName: 'MangaDex Scan',
    }));

    // Simulate 16 Komiku chapters (1 to 16 in Indonesian)
    const komikuChapters = Array.from({ length: 16 }, (_, i) => ({
      id: `komiku-ch:slug-ch-${i + 1}`,
      chapter: String(i + 1),
      volume: null,
      title: `Chapter ${i + 1}`,
      translatedLanguage: 'id',
      pages: 30,
      publishAt: '2026-01-02T00:00:00Z',
      groupName: 'Komiku ID',
    }));

    // Unified chapter map logic (mirrors server logic)
    const preferLang = 'id';
    const combined = [...mdChapters, ...komikuChapters];
    const chapterMap = new Map<string, any>();

    for (const ch of combined) {
      const match = String(ch.chapter || '').match(/[0-9]+(?:\.[0-9]+)?/);
      const key = match ? String(parseFloat(match[0])) : ch.chapter.trim().toLowerCase();
      const existing = chapterMap.get(key);

      if (!existing) {
        chapterMap.set(key, ch);
      } else {
        if (existing.translatedLanguage !== preferLang && ch.translatedLanguage === preferLang) {
          chapterMap.set(key, ch);
        }
      }
    }

    const result = Array.from(chapterMap.values());
    expect(result.length).toBe(16); // Total episodes unified into 16!
    expect(result.every((c) => ChapterSchema.safeParse(c).success)).toBe(true);

    // Verify chapters 1-8 preferred Indonesian from Komiku because preferLang is 'id'
    expect(result.find((c) => c.chapter === '1')?.translatedLanguage).toBe('id');
    // Verify chapters 9-16 were successfully included from Komiku
    expect(result.find((c) => c.chapter === '16')?.id).toBe('komiku-ch:slug-ch-16');
  });
});

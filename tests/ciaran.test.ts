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

  it('UUID Validator: rejects SQLi / Path Traversal strings', () => {
    expect(UuidParamSchema.safeParse('../../etc/passwd').success).toBe(false);
    expect(UuidParamSchema.safeParse("1' OR '1'='1").success).toBe(false);
    expect(UuidParamSchema.safeParse(mockMangaSoloLeveling.id).success).toBe(true);
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

  it('GET /api/chapter/:chapterId rejects invalid chapterId with 400', async () => {
    const res = await fetch(`${baseUrl}/api/chapter/not-a-uuid`);
    expect(res.status).toBe(400);
  });
});

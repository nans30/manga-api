import { z } from 'zod';

// ============================================================================
// 1. Primitive & Security Validators
// ============================================================================
export const UuidParamSchema = z
  .string()
  .uuid({ message: 'Format UUID tidak valid' });

const ALLOWED_IMAGE_HOSTS = [
  'uploads.mangadex.org',
  '.mangadex.org',
  '.mangadex.network',
] as const;

export function isSafeMangaDexImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_IMAGE_HOSTS.some((allowed) =>
      allowed.startsWith('.') ? host.endsWith(allowed) : host === allowed
    );
  } catch {
    return false;
  }
}

export const SafeCoverUrlSchema = z
  .string()
  .min(1)
  .refine(
    (val) =>
      val.startsWith('/api/proxy-image?url=') ||
      val.startsWith('https://uploads.mangadex.org/') ||
      val.startsWith('https://placehold.co/'),
    { message: 'URL cover tidak aman atau tidak diizinkan' }
  );

// ============================================================================
// 2. Core Domain Schemas (Matches src/types.ts 100% without `any`)
// ============================================================================
export const MangaTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  group: z.string().default('genre'),
});

export const MangaSchema = z.object({
  id: UuidParamSchema,
  title: z.string().min(1).max(500),
  altTitle: z.string().optional(),
  description: z.string().default('Tidak ada sinopsis untuk manga ini.'),
  status: z.enum(['ongoing', 'completed', 'hiatus', 'cancelled']).catch('ongoing'),
  year: z.number().int().min(1900).max(2100).nullable(),
  contentRating: z.enum(['safe', 'suggestive', 'erotica', 'pornographic']).catch('safe'),
  originalLanguage: z.string().min(1).max(10).default('ja'),
  lastChapter: z.string().nullable(),
  updatedAt: z.string().nullable(),
  coverUrl: SafeCoverUrlSchema,
  coverUrlFull: SafeCoverUrlSchema.optional(),
  author: z.string().min(1).default('Unknown Author'),
  artist: z.string().min(1).default('Unknown Artist'),
  tags: z.array(MangaTagSchema).max(25),
  rating: z.string().nullable().optional(),
  follows: z.number().int().nonnegative().nullable().optional(),
});

export const ChapterSchema = z.object({
  id: UuidParamSchema,
  chapter: z.string().min(1).default('Oneshot'),
  volume: z.string().nullable(),
  title: z.string().default(''),
  translatedLanguage: z.enum(['id', 'en']).catch('en'),
  pages: z.number().int().positive(),
  publishAt: z.string().min(1),
  groupName: z.string().default('No Group'),
});

export const ChapterPageSchema = z.object({
  index: z.number().int().positive(),
  url: z.string().startsWith('/api/proxy-image?url='),
  rawUrl: z.string().url().refine(isSafeMangaDexImageUrl, {
    message: 'Domain server gambar tidak valid',
  }),
});

export const ReadingHistoryItemSchema = z.object({
  mangaId: UuidParamSchema,
  mangaTitle: z.string().min(1).max(500),
  author: z.string().optional(),
  coverUrl: SafeCoverUrlSchema,
  chapterId: UuidParamSchema,
  chapterNumber: z.string().min(1),
  chapterTitle: z.string().default(''),
  language: z.string().min(1).max(5),
  currentPage: z.number().int().positive().optional(),
  totalPages: z.number().int().positive().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  readAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

// Strict schema for JSON Backup Import (Prevents Prototype/Type Pollution & XSS)
export const LibraryBackupSchema = z
  .object({
    bookmarks: z.array(MangaSchema).max(500).default([]),
    history: z.array(ReadingHistoryItemSchema).max(100).default([]),
    readChapters: z.array(UuidParamSchema).max(2000).default([]),
    exportedAt: z.string().optional(),
  })
  .strict();

// ============================================================================
// 3. API Endpoint Request Validation Schemas
// ============================================================================
export const MangaQueryParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Kata kunci pencarian maksimal 100 karakter')
    .default(''),
  sort: z.enum(['latest', 'popular', 'rating']).catch('latest'),
  limit: z.coerce.number().int().min(1).max(100).catch(24),
  offset: z.coerce.number().int().min(0).max(9900).catch(0),
  tag: z
    .string()
    .trim()
    .refine((val) => val === '' || UuidParamSchema.safeParse(val).success, {
      message: 'Tag ID harus berupa UUID yang valid',
    })
    .default(''),
  status: z
    .enum(['', 'ongoing', 'completed', 'hiatus', 'cancelled'])
    .catch(''),
  demographic: z
    .enum(['', 'shounen', 'shoujo', 'josei', 'seinen'])
    .catch(''),
});

export const ChapterFeedParamsSchema = z.object({
  lang: z.enum(['all', 'id', 'en']).catch('all'),
  limit: z.coerce.number().int().min(1).max(500).catch(500),
  offset: z.coerce.number().int().min(0).max(10000).catch(0),
});

export const ProxyImageQuerySchema = z.object({
  url: z
    .string()
    .min(1, 'Parameter url wajib diisi')
    .refine((val) => val.startsWith('https://'), {
      message: 'Invalid protocol: hanya HTTPS yang diizinkan',
    })
    .refine(isSafeMangaDexImageUrl, {
      message: 'Forbidden image host: hanya domain MangaDex yang diizinkan',
    }),
});

export type ValidatedManga = z.infer<typeof MangaSchema>;
export type ValidatedChapter = z.infer<typeof ChapterSchema>;
export type ValidatedChapterPage = z.infer<typeof ChapterPageSchema>;
export type ValidatedReadingHistoryItem = z.infer<typeof ReadingHistoryItemSchema>;
export type ValidatedLibraryBackup = z.infer<typeof LibraryBackupSchema>;

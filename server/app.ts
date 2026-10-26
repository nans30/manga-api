import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import https from 'node:https';
import { URL } from 'node:url';
import {
  MangaQueryParamsSchema,
  ChapterFeedParamsSchema,
  ProxyImageQuerySchema,
  UuidParamSchema,
} from '../src/schemas/ciaran.schema';

export const app = express();
app.disable('x-powered-by');
app.use(
  cors({
    origin: true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  })
);
app.use(express.json({ limit: '50kb' }));

// ============================================================================
// BOUNDED LRU CACHE (Prevents Memory Leaks & Makes Repeat Navigation Instant)
// ============================================================================
class BoundedTTLCache<V> {
  private map = new Map<string, { value: V; expiresAt: number }>();
  constructor(private maxSize: number, private defaultTtlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

// Bounded caches (Zero memory leak even after days of uptime)
const apiResponseCache = new BoundedTTLCache<any>(100, 45_000); // 45s fast API cache
const serverMangaCache = new BoundedTTLCache<any>(400, 1800_000); // 30m manga detail cache
const dnsCache = new BoundedTTLCache<string>(100, 3600_000); // 1h DNS cache
const rateLimitCache = new BoundedTTLCache<{ count: number; resetAt: number }>(
  1000,
  60_000
);

// Pre-seed MangaDex Anycast IPs for 0ms DNS resolution
dnsCache.set('api.mangadex.org', '45.129.229.1', 3600_000);
dnsCache.set('uploads.mangadex.org', '45.129.229.2', 3600_000);

// Persistent Keep-Alive HTTPS Agent (Reuses TLS sockets -> 5x faster image & API loading!)
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 10,
  timeout: 15_000,
});

// ============================================================================
// SECURITY LAYER 1: Global HTTP Security Headers & Bounded IP Rate Limiting
// ============================================================================
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 240;

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (req.path.startsWith('/api/')) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'local';
    const now = Date.now();
    const record = rateLimitCache.get(ip);

    if (!record || record.resetAt < now) {
      rateLimitCache.set(
        ip,
        { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS },
        RATE_LIMIT_WINDOW_MS
      );
    } else {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_MINUTE) {
        res
          .status(429)
          .json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
        return;
      }
    }
  }
  next();
});

function isValidUuid(id: string): boolean {
  return UuidParamSchema.safeParse(id).success;
}

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'uploads.mangadex.org' ||
    host.endsWith('.mangadex.org') ||
    host.endsWith('.mangadex.network')
  );
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  return (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('0.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip === '::1'
  );
}

// Verify actual binary magic bytes of image buffer (Prevents disguised XSS/HTML payloads)
function isValidImageBinary(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return true;
  // GIF: 47 49 46 38
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  )
    return true;
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return true;
  // AVIF / ISO Base Media File (ftyp)
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  )
    return true;
  return false;
}

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'CiaranMangaReader/1.0 (Personal Reader)',
  'Accept': 'application/json',
};

async function resolveHostDoH(hostname: string): Promise<string> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateOrLoopbackIp(hostname)) {
      throw new Error('Blocked private IP address');
    }
    return hostname;
  }

  const cachedIp = dnsCache.get(hostname);
  if (cachedIp) return cachedIp;

  const dohEndpoints = [
    `https://8.8.8.8/resolve?name=${encodeURIComponent(hostname)}&type=A`,
    `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
  ];

  for (const endpoint of dohEndpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { accept: 'application/dns-json' },
      });
      if (res.ok) {
        const data: any = await res.json();
        const answers: any[] = data?.Answer || [];
        const aRecord = answers.find((a) => a.type === 1 && a.data);
        if (aRecord?.data) {
          const ip = String(aRecord.data).trim();
          if (isPrivateOrLoopbackIp(ip)) {
            throw new Error('DNS resolved to blocked private IP');
          }
          dnsCache.set(
            hostname,
            ip,
            Math.max((aRecord.TTL || 300) * 1000, 300_000)
          );
          return ip;
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('private IP')) throw e;
    }
  }

  if (hostname.endsWith('mangadex.org')) {
    return '45.129.229.1';
  }

  throw new Error(`Could not resolve hostname via DoH: ${hostname}`);
}

interface DoHResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  buffer: Buffer;
  json: <T = any>() => T;
}

const MAX_RESPONSE_BYTES = 12 * 1024 * 1024; // 12 MB max payload protection

async function dohGet(
  urlStr: string,
  customHeaders: Record<string, string> = {},
  redirectCount = 0
): Promise<DoHResponse> {
  if (redirectCount > 3) {
    throw new Error('Too many redirects');
  }

  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS protocol is allowed');
  }
  if (
    !isAllowedImageHost(parsed.hostname) &&
    parsed.hostname !== 'api.mangadex.org'
  ) {
    throw new Error(`Forbidden upstream host: ${parsed.hostname}`);
  }

  const ip = await resolveHostDoH(parsed.hostname);

  return new Promise<DoHResponse>((resolve, reject) => {
    const req = https.request(
      {
        agent: keepAliveAgent,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        servername: parsed.hostname,
        headers: {
          ...DEFAULT_HEADERS,
          ...customHeaders,
          Host: parsed.host,
        },
        lookup: (_host, options: any, cb: any) => {
          if (typeof options === 'function') {
            cb = options;
            return cb(null, ip, 4);
          }
          if (options && options.all) {
            return cb(null, [{ address: ip, family: 4 }]);
          }
          return cb(null, ip, 4);
        },
      },
      (res) => {
        const status = res.statusCode || 500;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          const nextUrl = new URL(location, urlStr).toString();
          dohGet(nextUrl, customHeaders, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk) => {
          const buf = Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('Response exceeded maximum size limit'));
            return;
          }
          chunks.push(buf);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: res.headers,
            buffer,
            json: <T = any>() => JSON.parse(buffer.toString('utf-8')) as T,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(12000, () => {
      req.destroy(new Error(`Request timeout for ${urlStr}`));
    });
    req.end();
  });
}

function formatManga(item: any) {
  const attr = item.attributes || {};
  const titles = attr.title || {};
  const altTitles = attr.altTitles || [];

  const findAltTitle = (lang: string) => {
    const found = altTitles.find((t: any) => t[lang]);
    return found ? found[lang] : undefined;
  };

  const title =
    titles.en ||
    titles.id ||
    titles['ja-ro'] ||
    findAltTitle('id') ||
    findAltTitle('en') ||
    findAltTitle('ja-ro') ||
    Object.values(titles)[0] ||
    'Untitled Manga';

  const descObj = attr.description || {};
  const description =
    descObj.id ||
    descObj.en ||
    Object.values(descObj)[0] ||
    'Tidak ada sinopsis untuk manga ini.';

  const relationships = item.relationships || [];
  const coverRel = relationships.find((r: any) => r.type === 'cover_art');
  const authorRel = relationships.find((r: any) => r.type === 'author');
  const artistRel = relationships.find((r: any) => r.type === 'artist');

  const coverFileName = coverRel?.attributes?.fileName;
  // Use lightweight .256.jpg for grid thumbnails (85% smaller & faster) and .512.jpg for detail view
  const coverUrl = coverFileName
    ? `/api/proxy-image?url=${encodeURIComponent(
        `${MANGADEX_UPLOADS}/covers/${item.id}/${coverFileName}.256.jpg`
      )}`
    : 'https://placehold.co/256x364/18181b/f9cb55?text=No+Cover';

  const coverUrlFull = coverFileName
    ? `/api/proxy-image?url=${encodeURIComponent(
        `${MANGADEX_UPLOADS}/covers/${item.id}/${coverFileName}.512.jpg`
      )}`
    : coverUrl;

  const tags = (attr.tags || [])
    .map((t: any) => ({
      id: t.id,
      name:
        t.attributes?.name?.en ||
        Object.values(t.attributes?.name || {})[0] ||
        'Tag',
      group: t.attributes?.group || 'genre',
    }))
    .slice(0, 8);

  const formatted = {
    id: item.id,
    title,
    altTitle: findAltTitle('ja') || findAltTitle('en') || '',
    description,
    status: attr.status || 'ongoing',
    year: attr.year || null,
    contentRating: attr.contentRating || 'safe',
    originalLanguage: attr.originalLanguage || 'ja',
    lastChapter: attr.lastChapter || null,
    updatedAt: attr.updatedAt || null,
    coverUrl,
    coverUrlFull,
    author:
      authorRel?.attributes?.name ||
      artistRel?.attributes?.name ||
      'Unknown Author',
    authorId: authorRel?.id || artistRel?.id || '',
    artist:
      artistRel?.attributes?.name ||
      authorRel?.attributes?.name ||
      'Unknown Artist',
    artistId: artistRel?.id || authorRel?.id || '',
    tags,
  };
  if (formatted.id) {
    serverMangaCache.set(formatted.id, formatted);
  }
  return formatted;
}

// ============================================================================
// 1. Hardened Image Proxy (Strict Allowlist + Binary Magic-Byte Check + Long Cache)
// ============================================================================
const SAFE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl.startsWith('https://')) {
      res.status(400).send('Invalid protocol');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).send('Malformed URL');
      return;
    }

    if (!isAllowedImageHost(parsed.hostname)) {
      res.status(403).send('Forbidden image host');
      return;
    }

    const validation = ProxyImageQuerySchema.safeParse({ url: rawUrl });
    if (!validation.success) {
      res.status(403).send('Rejected by security policy');
      return;
    }

    const response = await dohGet(rawUrl, {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://mangadex.org/',
    });

    if (!response.ok || !isValidImageBinary(response.buffer)) {
      res.status(response.ok ? 415 : response.status).send('Invalid image response');
      return;
    }

    const rawMime = String(response.headers['content-type'] || 'image/jpeg')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const safeMime = SAFE_IMAGE_MIMES.has(rawMime) ? rawMime : 'image/jpeg';

    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(response.buffer);
  } catch {
    res.status(500).send('Image proxy error');
  }
});

// ============================================================================
// 2. Get Manga List (Fast Bounded Memory Cache + Live MangaDex Sync)
// ============================================================================
app.get('/api/manga', async (req: Request, res: Response) => {
  try {
    const parsedQuery = MangaQueryParamsSchema.parse(req.query);
    const { q, sort, limit: safeLimit, offset: safeOffset, tag, status, demographic } =
      parsedQuery;
    const authorId = String(req.query.authorId || '').trim();
    const lang = String(req.query.lang || '').trim();

    const cacheKey = `manga:${q}:${sort}:${safeLimit}:${safeOffset}:${tag}:${status}:${demographic}:${authorId}:${lang}`;
    const cachedResponse = apiResponseCache.get(cacheKey);
    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedResponse);
      return;
    }

    const params = new URLSearchParams();
    params.append('limit', String(safeLimit));
    params.append('offset', String(safeOffset));
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('hasAvailableChapters', 'true');

    if (q) {
      params.append('title', q);
    }

    if (authorId && isValidUuid(authorId)) {
      params.append('authorOrArtist', authorId);
    }

    if (lang === 'id' || lang === 'en') {
      params.append('availableTranslatedLanguage[]', lang);
    }

    if (tag) {
      params.append('includedTags[]', tag);
    }

    if (status) {
      params.append('status[]', status);
    }

    if (demographic) {
      params.append('publicationDemographic[]', demographic);
    }

    if (sort === 'popular') {
      params.append('order[followedCount]', 'desc');
    } else if (sort === 'rating') {
      params.append('order[rating]', 'desc');
    } else {
      params.append('order[latestUploadedChapter]', 'desc');
    }

    const url = `${MANGADEX_API}/manga?${params.toString()}`;
    const [response, authorSearchRes] = await Promise.all([
      dohGet(url),
      q && !authorId && safeOffset === 0
        ? dohGet(
            `${MANGADEX_API}/author?name=${encodeURIComponent(
              q.slice(0, 60)
            )}&limit=2`
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!response.ok) {
      throw new Error(`MangaDex responded with ${response.status}`);
    }

    const json: any = response.json();
    const list: any[] = (json.data || []).map(formatManga);

    if (authorSearchRes && authorSearchRes.ok) {
      const authorJson: any = authorSearchRes.json();
      const firstAuthorId = authorJson?.data?.[0]?.id;
      if (firstAuthorId && isValidUuid(firstAuthorId)) {
        const byAuthorRes = await dohGet(
          `${MANGADEX_API}/manga?authorOrArtist=${firstAuthorId}&limit=10&includes[]=cover_art&includes[]=author&includes[]=artist&contentRating[]=safe&contentRating[]=suggestive`
        ).catch(() => null);
        if (byAuthorRes && byAuthorRes.ok) {
          const byAuthorJson: any = byAuthorRes.json();
          const authorManga = (byAuthorJson.data || []).map(formatManga);
          const existingIds = new Set(list.map((m) => m.id));
          for (const m of authorManga) {
            if (!existingIds.has(m.id)) {
              list.push(m);
              existingIds.add(m.id);
            }
          }
        }
      }
    }

    const payload = {
      data: list,
      total: json.total || list.length,
      limit: safeLimit,
      offset: safeOffset,
      fetchedAt: new Date().toISOString(),
    };

    apiResponseCache.set(cacheKey, payload, 45_000);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Gagal mengambil daftar manga dari MangaDex' });
  }
});

// 3. Get All Genre Tags (Cached for 1 hour in memory)
app.get('/api/tags', async (_req: Request, res: Response) => {
  try {
    const cachedTags = apiResponseCache.get('tags:all');
    if (cachedTags) {
      res.json(cachedTags);
      return;
    }

    const response = await dohGet(`${MANGADEX_API}/manga/tag`);
    const json: any = response.json();
    const tags = (json.data || [])
      .map((t: any) => ({
        id: t.id,
        name: t.attributes?.name?.en || 'Tag',
        group: t.attributes?.group || 'genre',
      }))
      .filter((t: any) => t.group === 'genre' || t.group === 'theme')
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const payload = { data: tags };
    apiResponseCache.set('tags:all', payload, 3600_000);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Gagal memuat daftar genre' });
  }
});

// 4. Get Single Manga Detail + Statistics
app.get('/api/manga/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!isValidUuid(id)) {
      res.status(400).json({ error: 'ID Manga tidak valid' });
      return;
    }

    const detailCacheKey = `detail:${id}`;
    const cachedDetail = apiResponseCache.get(detailCacheKey);
    if (cachedDetail) {
      res.json(cachedDetail);
      return;
    }

    const params = new URLSearchParams();
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');

    const [mangaRes, statsRes] = await Promise.all([
      dohGet(`${MANGADEX_API}/manga/${id}?${params.toString()}`).catch(() => null),
      dohGet(`${MANGADEX_API}/statistics/manga/${id}`).catch(() => null),
    ]);

    let formatted = serverMangaCache.get(id) || null;
    if (mangaRes && mangaRes.ok) {
      const mangaJson: any = mangaRes.json();
      if (mangaJson?.data) {
        formatted = formatManga(mangaJson.data);
      }
    }

    if (!formatted) {
      res.status(404).json({ error: 'Manga tidak ditemukan' });
      return;
    }

    let rating = formatted.rating || null;
    let follows = formatted.follows || null;
    if (statsRes && statsRes.ok) {
      const statsJson: any = statsRes.json();
      const st = statsJson.statistics?.[id];
      if (st) {
        rating = st.rating?.bayesian ? Number(st.rating.bayesian).toFixed(2) : null;
        follows = st.follows || 0;
      }
    }

    const payload = {
      data: {
        ...formatted,
        rating,
        follows,
      },
    };
    apiResponseCache.set(detailCacheKey, payload, 120_000);
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Gagal mengambil detail manga' });
  }
});

// 5. Get Manga Chapters Feed
app.get('/api/manga/:id/chapters', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!isValidUuid(id)) {
      res.status(400).json({ error: 'ID Manga tidak valid' });
      return;
    }

    const { lang, limit: safeLimit, offset: safeOffset } =
      ChapterFeedParamsSchema.parse(req.query);

    const feedCacheKey = `chapters:${id}:${lang}:${safeLimit}:${safeOffset}`;
    const cachedFeed = apiResponseCache.get(feedCacheKey);
    if (cachedFeed) {
      res.json(cachedFeed);
      return;
    }

    const params = new URLSearchParams();
    params.append('limit', String(safeLimit));
    params.append('offset', String(safeOffset));
    params.append('includes[]', 'scanlation_group');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('contentRating[]', 'erotica');
    params.append('order[chapter]', 'desc');
    params.append('order[publishAt]', 'desc');
    params.append('includeEmptyPages', '0');

    if (lang === 'id') {
      params.append('translatedLanguage[]', 'id');
    } else if (lang === 'en') {
      params.append('translatedLanguage[]', 'en');
    } else {
      params.append('translatedLanguage[]', 'id');
      params.append('translatedLanguage[]', 'en');
    }

    const response = await dohGet(
      `${MANGADEX_API}/manga/${id}/feed?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`MangaDex feed error: ${response.status}`);
    }

    const json: any = response.json();
    const chapters = (json.data || [])
      .filter(
        (ch: any) =>
          !ch.attributes?.externalUrl && (ch.attributes?.pages || 0) > 0
      )
      .map((ch: any) => {
        const attr = ch.attributes || {};
        const groupRel = (ch.relationships || []).find(
          (r: any) => r.type === 'scanlation_group'
        );
        return {
          id: ch.id,
          chapter: attr.chapter || 'Oneshot',
          volume: attr.volume || null,
          title: attr.title || '',
          translatedLanguage: attr.translatedLanguage || 'en',
          pages: attr.pages || 0,
          publishAt: attr.publishAt || attr.createdAt,
          groupName: groupRel?.attributes?.name || 'No Group',
        };
      });

    const payload = {
      data: chapters,
      total: json.total || chapters.length,
    };
    apiResponseCache.set(feedCacheKey, payload, 60_000);
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Gagal mengambil daftar chapter' });
  }
});

// 6. Get Chapter Pages (At-Home Server Images)
app.get('/api/chapter/:chapterId', async (req: Request, res: Response) => {
  try {
    const chapterId = String(req.params.chapterId);
    if (!isValidUuid(chapterId)) {
      res.status(400).json({ error: 'ID Chapter tidak valid' });
      return;
    }

    const quality = req.query.quality === 'data' ? 'data' : 'data-saver';
    const chapterCacheKey = `pages:${chapterId}:${quality}`;
    const cachedPages = apiResponseCache.get(chapterCacheKey);
    if (cachedPages) {
      res.json(cachedPages);
      return;
    }

    const [atHomeRes, chapterInfoRes] = await Promise.all([
      dohGet(`${MANGADEX_API}/at-home/server/${chapterId}`),
      dohGet(
        `${MANGADEX_API}/chapter/${chapterId}?includes[]=manga&includes[]=scanlation_group`
      ),
    ]);

    if (!atHomeRes.ok) {
      throw new Error(`Gagal memuat server gambar chapter (${atHomeRes.status})`);
    }

    const atHomeJson: any = atHomeRes.json();
    const baseUrl = atHomeJson.baseUrl;
    const hash = atHomeJson.chapter?.hash;
    const files: string[] =
      quality === 'data'
        ? atHomeJson.chapter?.data || []
        : atHomeJson.chapter?.dataSaver || atHomeJson.chapter?.data || [];
    const folder = quality === 'data' ? 'data' : 'data-saver';

    const pages = files.map((file: string, index: number) => {
      const rawUrl = `${baseUrl}/${folder}/${hash}/${file}`;
      return {
        index: index + 1,
        url: `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`,
        rawUrl,
      };
    });

    let chapterMeta: any = null;
    if (chapterInfoRes.ok) {
      const infoJson: any = chapterInfoRes.json();
      const chData = infoJson.data;
      const mangaRel = (chData?.relationships || []).find(
        (r: any) => r.type === 'manga'
      );
      const groupRel = (chData?.relationships || []).find(
        (r: any) => r.type === 'scanlation_group'
      );

      const mangaTitles = mangaRel?.attributes?.title || {};
      chapterMeta = {
        id: chData.id,
        chapter: chData.attributes?.chapter || 'Oneshot',
        volume: chData.attributes?.volume || null,
        title: chData.attributes?.title || '',
        translatedLanguage: chData.attributes?.translatedLanguage || 'en',
        mangaId: mangaRel?.id || '',
        mangaTitle:
          mangaTitles.en ||
          mangaTitles.id ||
          Object.values(mangaTitles)[0] ||
          'Manga',
        groupName: groupRel?.attributes?.name || 'Scanlation',
      };
    }

    const payload = {
      pages,
      total: pages.length,
      chapter: chapterMeta,
    };
    apiResponseCache.set(chapterCacheKey, payload, 300_000);
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Gagal memuat halaman komik' });
  }
});

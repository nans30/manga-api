import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

export const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ============================================================================
// SECURITY LAYER 1: Global HTTP Security Headers & Rate Limiting
// ============================================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 180; // generous for reading pages, blocks abuse

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.path.startsWith('/api/')) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || record.resetAt < now) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_MINUTE) {
        res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
        return;
      }
    }
  }
  next();
});

// Strict UUID v4 validator to prevent Path Traversal / SSRF on :id parameters
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Strict Domain Allowlist for Image Proxy (Prevents Open Proxy / SSRF attacks)
function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'uploads.mangadex.org' ||
    host.endsWith('.mangadex.org') ||
    host.endsWith('.mangadex.network')
  );
}

// Prevent private/loopback IP resolution (SSRF DNS Rebinding protection)
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

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'CiaranMangaReader/1.0 (Personal Reader)',
  'Accept': 'application/json',
};

// ============================================================================
// DNS-over-HTTPS (DoH) Resolver & HTTPS Client
// Bypasses Indonesian ISP DNS Blocking (Telkomsel / IndiHome) safely
// ============================================================================
const dnsCache = new Map<string, { ip: string; expires: number }>();

dnsCache.set('api.mangadex.org', { ip: '45.129.229.1', expires: Date.now() + 3600_000 });
dnsCache.set('uploads.mangadex.org', { ip: '45.129.229.2', expires: Date.now() + 3600_000 });

async function resolveHostDoH(hostname: string): Promise<string> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateOrLoopbackIp(hostname)) {
      throw new Error('Blocked private IP address');
    }
    return hostname;
  }

  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) {
    return cached.ip;
  }

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
          dnsCache.set(hostname, {
            ip,
            expires: Date.now() + Math.max((aRecord.TTL || 300) * 1000, 300_000),
          });
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

const MAX_RESPONSE_BYTES = 15 * 1024 * 1024; // 15 MB max payload protection

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
  if (!isAllowedImageHost(parsed.hostname) && parsed.hostname !== 'api.mangadex.org') {
    throw new Error(`Forbidden upstream host: ${parsed.hostname}`);
  }

  const ip = await resolveHostDoH(parsed.hostname);

  return new Promise<DoHResponse>((resolve, reject) => {
    const req = https.request(
      {
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
    req.setTimeout(15000, () => {
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
  const coverUrl = coverFileName
    ? `/api/proxy-image?url=${encodeURIComponent(
        `${MANGADEX_UPLOADS}/covers/${item.id}/${coverFileName}.512.jpg`
      )}`
    : 'https://placehold.co/512x728/18181b/f9cb55?text=No+Cover';

  const coverUrlFull = coverFileName
    ? `/api/proxy-image?url=${encodeURIComponent(
        `${MANGADEX_UPLOADS}/covers/${item.id}/${coverFileName}`
      )}`
    : coverUrl;

  const tags = (attr.tags || [])
    .map((t: any) => ({
      id: t.id,
      name: t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0] || 'Tag',
      group: t.attributes?.group || 'genre',
    }))
    .slice(0, 8);

  return {
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
    author: authorRel?.attributes?.name || artistRel?.attributes?.name || 'Unknown Author',
    authorId: authorRel?.id || artistRel?.id || '',
    artist: artistRel?.attributes?.name || authorRel?.attributes?.name || 'Unknown Artist',
    artistId: artistRel?.id || authorRel?.id || '',
    tags,
  };
}

// Helper to auto-sync local mangadex-cache.json in background when running locally
function updateLocalCacheBackground(sortKey: string, list: any[]) {
  try {
    const cacheFile = path.resolve(process.cwd(), 'src', 'data', 'mangadex-cache.json');
    if (!fs.existsSync(cacheFile)) return;
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (sortKey === 'latest' || sortKey === 'popular' || sortKey === 'rating') {
      raw[sortKey] = list;
      raw.scrapedAt = new Date().toISOString();
      fs.writeFileSync(cacheFile, JSON.stringify(raw, null, 2), 'utf-8');
    }
  } catch {
    // Ignore on read-only serverless environments (like Vercel)
  }
}

// 1. Hardened Image Proxy (Strict Allowlist + MIME Sanitization)
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
    const imageUrl = String(req.query.url || '');
    if (!imageUrl.startsWith('https://')) {
      res.status(400).send('Invalid protocol');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      res.status(400).send('Malformed URL');
      return;
    }

    if (!isAllowedImageHost(parsed.hostname)) {
      res.status(403).send('Forbidden image host');
      return;
    }

    const response = await dohGet(imageUrl, {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://mangadex.org/',
    });

    if (!response.ok) {
      res.status(response.status).send('Failed to fetch image');
      return;
    }

    const rawMime = String(response.headers['content-type'] || 'image/jpeg')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const safeMime = SAFE_IMAGE_MIMES.has(rawMime) ? rawMime : 'image/jpeg';

    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.send(response.buffer);
  } catch (err) {
    res.status(500).send('Image proxy error');
  }
});

// 2. Get Manga List (Real-time from MangaDex + Auto Cache Sync)
app.get('/api/manga', async (req: Request, res: Response) => {
  try {
    const {
      q = '',
      sort = 'latest',
      limit = '24',
      offset = '0',
      tag = '',
      status = '',
      demographic = '',
      authorId = '',
      lang = '',
    } = req.query as Record<string, string>;

    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 24));
    const safeOffset = Math.min(9900, Math.max(0, Number(offset) || 0));

    const params = new URLSearchParams();
    params.append('limit', String(safeLimit));
    params.append('offset', String(safeOffset));
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('hasAvailableChapters', 'true');

    if (q.trim()) {
      params.append('title', q.trim().slice(0, 100));
    }

    if (authorId.trim() && isValidUuid(authorId.trim())) {
      params.append('authorOrArtist', authorId.trim());
    }

    if (lang === 'id' || lang === 'en') {
      params.append('availableTranslatedLanguage[]', lang);
    }

    if (tag.trim() && isValidUuid(tag.trim())) {
      params.append('includedTags[]', tag.trim());
    }

    if (['ongoing', 'completed', 'hiatus', 'cancelled'].includes(status.trim())) {
      params.append('status[]', status.trim());
    }

    if (['shounen', 'shoujo', 'josei', 'seinen'].includes(demographic.trim())) {
      params.append('publicationDemographic[]', demographic.trim());
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
      q.trim() && !authorId.trim() && safeOffset === 0
        ? dohGet(
            `${MANGADEX_API}/author?name=${encodeURIComponent(
              q.trim().slice(0, 60)
            )}&limit=2`
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!response.ok) {
      throw new Error(`MangaDex responded with ${response.status}`);
    }

    const json: any = response.json();
    let list: any[] = (json.data || []).map(formatManga);

    // If user searched a creator/author name, include manga by that author as well
    if (authorSearchRes && authorSearchRes.ok) {
      const authorJson: any = authorSearchRes.json();
      const firstAuthorId = authorJson?.data?.[0]?.id;
      if (firstAuthorId && isValidUuid(firstAuthorId)) {
        const byAuthorRes = await dohGet(
          `${MANGADEX_API}/manga?authorOrArtist=${firstAuthorId}&limit=12&includes[]=cover_art&includes[]=author&includes[]=artist&contentRating[]=safe&contentRating[]=suggestive`
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

    // If default first page fetch, keep local cache JSON fresh automatically
    if (
      !q.trim() &&
      !authorId.trim() &&
      !lang.trim() &&
      !tag.trim() &&
      !status.trim() &&
      safeOffset === 0 &&
      list.length >= 12
    ) {
      updateLocalCacheBackground(sort, list);
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.json({
      data: list,
      total: json.total || list.length,
      limit: safeLimit,
      offset: safeOffset,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal mengambil daftar manga dari MangaDex' });
  }
});

// 3. Get All Genre Tags
app.get('/api/tags', async (_req: Request, res: Response) => {
  try {
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

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.json({ data: tags });
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

    const params = new URLSearchParams();
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');

    const [mangaRes, statsRes] = await Promise.all([
      dohGet(`${MANGADEX_API}/manga/${id}?${params.toString()}`),
      dohGet(`${MANGADEX_API}/statistics/manga/${id}`).catch(() => null),
    ]);

    if (!mangaRes.ok) {
      res.status(mangaRes.status).json({ error: 'Manga tidak ditemukan' });
      return;
    }

    const mangaJson: any = mangaRes.json();
    const formatted = formatManga(mangaJson.data);

    let rating = null;
    let follows = null;
    if (statsRes && statsRes.ok) {
      const statsJson: any = statsRes.json();
      const st = statsJson.statistics?.[id];
      if (st) {
        rating = st.rating?.bayesian ? Number(st.rating.bayesian).toFixed(2) : null;
        follows = st.follows || 0;
      }
    }

    res.json({
      data: {
        ...formatted,
        rating,
        follows,
      },
    });
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

    const { lang = 'all', limit = '500', offset = '0' } = req.query as Record<string, string>;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 500));
    const safeOffset = Math.min(10000, Math.max(0, Number(offset) || 0));

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

    const response = await dohGet(`${MANGADEX_API}/manga/${id}/feed?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`MangaDex feed error: ${response.status}`);
    }

    const json: any = response.json();
    const chapters = (json.data || [])
      .filter((ch: any) => !ch.attributes?.externalUrl && (ch.attributes?.pages || 0) > 0)
      .map((ch: any) => {
        const attr = ch.attributes || {};
        const groupRel = (ch.relationships || []).find((r: any) => r.type === 'scanlation_group');
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

    res.json({
      data: chapters,
      total: json.total || chapters.length,
    });
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

    const { quality = 'data-saver' } = req.query as Record<string, string>;

    const [atHomeRes, chapterInfoRes] = await Promise.all([
      dohGet(`${MANGADEX_API}/at-home/server/${chapterId}`),
      dohGet(`${MANGADEX_API}/chapter/${chapterId}?includes[]=manga&includes[]=scanlation_group`),
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
      const mangaRel = (chData?.relationships || []).find((r: any) => r.type === 'manga');
      const groupRel = (chData?.relationships || []).find((r: any) => r.type === 'scanlation_group');

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

    res.json({
      pages,
      total: pages.length,
      chapter: chapterMeta,
    });
  } catch {
    res.status(500).json({ error: 'Gagal memuat halaman komik' });
  }
});

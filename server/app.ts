import express, { Request, Response } from 'express';
import cors from 'cors';
import https from 'node:https';
import { URL } from 'node:url';

export const app = express();
app.use(cors());
app.use(express.json());

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'CiaranMangaReader/1.0 (Personal Reader)',
  'Accept': 'application/json',
};

// ============================================================================
// DNS-over-HTTPS (DoH) Resolver & HTTPS Client
// Bypasses Indonesian ISP DNS Blocking (Telkomsel Internet Baik / IndiHome / Kominfo)
// without needing VPN or Cloudflare WARP!
// ============================================================================
const dnsCache = new Map<string, { ip: string; expires: number }>();

// Pre-seed known MangaDex Anycast IPs for instant 0ms connection
dnsCache.set('api.mangadex.org', { ip: '45.129.229.1', expires: Date.now() + 3600_000 });
dnsCache.set('uploads.mangadex.org', { ip: '45.129.229.2', expires: Date.now() + 3600_000 });

async function resolveHostDoH(hostname: string): Promise<string> {
  // If already an IPv4 address, return as-is
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) {
    return cached.ip;
  }

  // Query Google DoH directly by IP (8.8.8.8) so ISP DNS cannot intercept it
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
          dnsCache.set(hostname, {
            ip,
            expires: Date.now() + Math.max((aRecord.TTL || 300) * 1000, 300_000),
          });
          return ip;
        }
      }
    } catch {
      // Try next DoH provider
    }
  }

  // Fallback for *.mangadex.org
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

async function dohGet(
  urlStr: string,
  customHeaders: Record<string, string> = {},
  redirectCount = 0
): Promise<DoHResponse> {
  if (redirectCount > 5) {
    throw new Error('Too many redirects');
  }

  const parsed = new URL(urlStr);
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
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
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

// Helper to format MangaDex manga item into clean frontend object
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
    : 'https://placehold.co/512x728/18181b/f97316?text=No+Cover';

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
    artist: artistRel?.attributes?.name || authorRel?.attributes?.name || 'Unknown Artist',
    tags,
  };
}

// 1. Proxy Image via DoH to bypass ISP blocking & MangaDex hotlink protection
app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      res.status(400).send('Invalid URL');
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

    const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.send(response.buffer);
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(500).send('Image proxy error');
  }
});

// 2. Get Manga List (Latest Updates, Popular, Search, Tag Filter)
app.get('/api/manga', async (req: Request, res: Response) => {
  try {
    const {
      q = '',
      sort = 'latest', // 'latest' | 'popular' | 'rating'
      limit = '24',
      offset = '0',
      tag = '',
      status = '',
      demographic = '',
    } = req.query as Record<string, string>;

    const params = new URLSearchParams();
    params.append('limit', limit);
    params.append('offset', offset);
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('hasAvailableChapters', 'true');

    if (q.trim()) {
      params.append('title', q.trim());
    }

    if (tag.trim()) {
      params.append('includedTags[]', tag.trim());
    }

    if (status.trim()) {
      params.append('status[]', status.trim());
    }

    if (demographic.trim()) {
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
    const response = await dohGet(url);

    if (!response.ok) {
      throw new Error(`MangaDex responded with ${response.status}`);
    }

    const json: any = response.json();
    const list = (json.data || []).map(formatManga);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.json({
      data: list,
      total: json.total || list.length,
      limit: Number(limit),
      offset: Number(offset),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error fetching manga list:', err);
    res.status(500).json({ error: err.message || 'Gagal mengambil daftar manga dari MangaDex' });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat daftar genre' });
  }
});

// 4. Get Single Manga Detail + Statistics
app.get('/api/manga/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil detail manga' });
  }
});

// 5. Get Manga Chapters Feed (Supports ID, EN, or All languages)
app.get('/api/manga/:id/chapters', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { lang = 'all', limit = '500', offset = '0' } = req.query as Record<string, string>;

    const params = new URLSearchParams();
    params.append('limit', limit);
    params.append('offset', offset);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil daftar chapter' });
  }
});

// 6. Get Chapter Pages (At-Home Server Images)
app.get('/api/chapter/:chapterId', async (req: Request, res: Response) => {
  try {
    const chapterId = String(req.params.chapterId);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat halaman komik' });
  }
});

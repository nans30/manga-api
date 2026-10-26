import express, { Request, Response } from 'express';
import cors from 'cors';

export const app = express();
app.use(cors());
app.use(express.json());

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org';

const DEFAULT_HEADERS = {
  'User-Agent': 'CiaranMangaReader/1.0 (Personal Reader)',
  'Accept': 'application/json',
};

// Helper to format MangaDex manga item into clean frontend object
function formatManga(item: any) {
  const attr = item.attributes || {};
  const titles = attr.title || {};
  const altTitles = attr.altTitles || [];

  // Prefer English, Indonesian, Romaji, or first available title
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

// 1. Proxy Image to bypass MangaDex hotlink protection on Vercel & local
app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      res.status(400).send('Invalid URL');
      return;
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        'Referer': 'https://mangadex.org/',
      },
    });

    if (!response.ok) {
      res.status(response.status).send('Failed to fetch image');
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
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
      // Realtime latest uploaded chapter
      params.append('order[latestUploadedChapter]', 'desc');
    }

    const url = `${MANGADEX_API}/manga?${params.toString()}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new Error(`MangaDex responded with ${response.status}`);
    }

    const json: any = await response.json();
    const list = (json.data || []).map(formatManga);

    // Short cache so updates are always fresh
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
    const response = await fetch(`${MANGADEX_API}/manga/tag`, {
      headers: DEFAULT_HEADERS,
    });
    const json: any = await response.json();
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
      fetch(`${MANGADEX_API}/manga/${id}?${params.toString()}`, { headers: DEFAULT_HEADERS }),
      fetch(`${MANGADEX_API}/statistics/manga/${id}`, { headers: DEFAULT_HEADERS }).catch(() => null),
    ]);

    if (!mangaRes.ok) {
      res.status(mangaRes.status).json({ error: 'Manga tidak ditemukan' });
      return;
    }

    const mangaJson: any = await mangaRes.json();
    const formatted = formatManga(mangaJson.data);

    let rating = null;
    let follows = null;
    if (statsRes && statsRes.ok) {
      const statsJson: any = await statsRes.json();
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
      // Prioritaskan Bahasa Indonesia & Inggris
      params.append('translatedLanguage[]', 'id');
      params.append('translatedLanguage[]', 'en');
    }

    const response = await fetch(`${MANGADEX_API}/manga/${id}/feed?${params.toString()}`, {
      headers: DEFAULT_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`MangaDex feed error: ${response.status}`);
    }

    const json: any = await response.json();
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
      fetch(`${MANGADEX_API}/at-home/server/${chapterId}`, { headers: DEFAULT_HEADERS }),
      fetch(`${MANGADEX_API}/chapter/${chapterId}?includes[]=manga&includes[]=scanlation_group`, {
        headers: DEFAULT_HEADERS,
      }),
    ]);

    if (!atHomeRes.ok) {
      throw new Error(`Gagal memuat server gambar chapter (${atHomeRes.status})`);
    }

    const atHomeJson: any = await atHomeRes.json();
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
      const infoJson: any = await chapterInfoRes.json();
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

import fs from 'node:fs';
import path from 'node:path';
import { app } from './app';

async function runScraper() {
  console.log('🔍 Memulai scraping data real-time dari MangaDex (via DoH Bypass)...');

  const srv = app.listen(0, async () => {
    try {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3001;
      const base = `http://localhost:${port}`;

      const [latestRes, popularRes, ratingRes, tagsRes]: any[] = await Promise.all([
        fetch(`${base}/api/manga?sort=latest&limit=24`).then((r) => r.json()),
        fetch(`${base}/api/manga?sort=popular&limit=24`).then((r) => r.json()),
        fetch(`${base}/api/manga?sort=rating&limit=24`).then((r) => r.json()),
        fetch(`${base}/api/tags`).then((r) => r.json()),
      ]);

      const cacheData = {
        scrapedAt: new Date().toISOString(),
        source: 'https://mangadex.org',
        latest: latestRes.data || [],
        popular: popularRes.data || [],
        rating: ratingRes.data || [],
        tags: tagsRes.data || [],
      };

      const outDir = path.resolve(process.cwd(), 'src', 'data');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'mangadex-cache.json');
      fs.writeFileSync(outFile, JSON.stringify(cacheData, null, 2), 'utf-8');

      console.log(`✅ Berhasil scraping data dari MangaDex!`);
      console.log(`   - Update Terbaru : ${cacheData.latest.length} manga`);
      console.log(`   - Populer        : ${cacheData.popular.length} manga`);
      console.log(`   - Rating Tinggi  : ${cacheData.rating.length} manga`);
      console.log(`   - Total Genre    : ${cacheData.tags.length} genre`);
      console.log(`📁 Disimpan ke: ${outFile}`);
    } catch (err) {
      console.error('❌ Gagal scraping:', err);
    } finally {
      srv.close();
    }
  });
}

runScraper();

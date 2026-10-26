# Ciaran — Personal Manga Reader (MangaDex Live API)

Aplikasi web pembaca komik (Manga, Manhwa, Manhua) pribadi berbasis **React + TypeScript + Tailwind CSS** dan **Node.js (Express)** yang terhubung secara *real-time* ke API resmi **MangaDex** (`https://api.mangadex.org`).

Dirancang khusus agar nyaman dibaca di **PC (Desktop)** maupun **HP (Mobile)** dan siap langsung di-deploy gratis ke **Vercel**.

---

## Fitur Utama
- **Update Setiap Saat (Live Sync):** Mengambil update chapter terbaru langsung dari MangaDex secara real-time + auto-refresh setiap 60 detik.
- **Filter Bahasa Indonesia & Inggris:** Mendukung chapter terjemahan Bahasa Indonesia (`id`), Inggris (`en`), atau gabungan keduanya.
- **Image Proxy Anti-Blokir:** Dilengkapi endpoint `/api/proxy-image` agar cover dan halaman manga tidak terkena blokir CORS/Hotlink saat di-host di Vercel atau dibuka di HP.
- **Mode Baca Nyaman (PC & HP):**
  - **Mode Webtoon (Scroll Vertikal):** Cocok untuk baca satu tangan di HP.
  - **Mode Per Halaman (Single Page):** Mendukung navigasi tombol keyboard `←` / `→` di PC atau tap kiri/kanan layar.
  - **Pengaturan Kualitas:** *Hemat Kuota (Data Saver)* untuk jaringan seluler atau *HD Original*.
- **Tanpa Perlu Database Server (FlyEnv Off):** Bookmark & Riwayat Baca tersimpan otomatis di `localStorage` perangkat + dilengkapi fitur **Backup/Restore JSON** untuk memindahkan koleksi antara PC dan HP.

---

## Cara Menjalankan di Lokal (PC)

1. Buka terminal di folder `D:\coding\ciaran`:
   ```bash
   cd D:\coding\ciaran
   ```
2. Jalankan server Frontend + Backend sekaligus:
   ```bash
   npm run dev
   ```
3. Buka di browser: **`http://localhost:5173`**

*(Catatan: Anda **tidak perlu** menyalakan MySQL, PostgreSQL, atau Nginx di FlyEnv!)*

---

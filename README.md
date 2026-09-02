# JSCB GitHub — Timeline A + B

Versi ini mengubah tampilan dari **7 kolom proses/Kanban** menjadi **timeline horizontal seperti spreadsheet JPCB**.

## Struktur

- `index.html` — tampilan.
- `style.css` — CSS timeline.
- `app.js` — frontend pembaca JSON.
- `GitHubAPI.gs` — Apps Script read-only untuk mengambil JPCB A, JPCB B dan NOTIFIKASI.

## Penting

`GitHubAPI.gs` sebaiknya dibuat sebagai **project Apps Script terpisah** tetapi menggunakan spreadsheet yang sama. Jangan mengganti `doGet()` pada sistem JPCB/QC yang sudah ada.

### 1. Apps Script

Buat project Apps Script baru → tambahkan `GitHubAPI.gs` → paste kode → Deploy sebagai Web App.

Set akses sesuai kebutuhan dashboard. Setelah mendapat URL `/exec`, masukkan ke:

```javascript
const API_URL = "URL_WEB_APP_APPS_SCRIPT";
```

pada `app.js`.

### 2. GitHub Pages

Upload:

- `index.html`
- `style.css`
- `app.js`

`GitHubAPI.gs` tidak perlu di-upload ke GitHub Pages.

## Asumsi struktur JPCB

- Baris tanggal timeline: 2
- Baris jam: 3
- Timeline mulai kolom G
- Data unit mulai baris 4

Jika struktur sumber berbeda, ubah `API_CONFIG` di `GitHubAPI.gs` saja.

## Fitur

- JPCB A + JPCB B digabung dalam satu papan.
- Header hari → tanggal → jam.
- Kolom GRUP, IDENTITAS UNIT, ACTUAL PROSES dibuat sticky.
- Timeline horizontal dan scroll vertikal.
- Search WO/nopol/kendaraan/SA/proses.
- Filter JPCB A / JPCB B / Semua.
- Notifikasi hanya dibaca dari sheet `NOTIFIKASI`.
- Auto refresh 60 detik.
- Tidak ada `localStorage` untuk data produksi.

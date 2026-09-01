# JSCB — Joint Process Control Board

Prototype frontend untuk menggabungkan papan **JPCB A + JPCB B** menjadi satu tampilan JSCB.

## Prinsip penting

Project ini **tidak mengubah spreadsheet atau Apps Script lama**.

Struktur yang dipertahankan:
- JPCB A tetap berjalan.
- JPCB B tetap berjalan.
- Sistem notifikasi lama tetap berjalan.
- GitHub hanya menjadi **lapisan tampilan/dashboard**.

## Isi

- `index.html` — halaman utama.
- `style.css` — tampilan responsive.
- `app.js` — logika papan JSCB dan notifikasi demo.

## Tampilan JSCB

Papan memiliki 7 kolom proses:

1. Panel Repair
2. Putty / Surfacer
3. Masking / Spraying
4. Poles
5. Reassy
6. Finishing
7. FI

Unit dari JPCB A dan JPCB B ditampilkan pada papan yang sama.

## Tahap berikutnya

Data demo di `app.js` nantinya diganti dengan data aktual dari sumber yang aman, misalnya endpoint JSON dari sistem yang sudah ada.

Arsitektur yang disarankan:

Google Sheets
   ↓
Apps Script / endpoint data
   ↓
JSCB GitHub
   ├── Papan JSCB
   ├── Pencarian
   ├── Filter JPCB A/B
   └── Notifikasi

Tidak perlu memindahkan database ke GitHub.

## Catatan

GitHub Pages hanya menyajikan frontend. Data sensitif workshop sebaiknya tetap berada di Google Sheets/Apps Script dan akses endpoint perlu dikontrol.

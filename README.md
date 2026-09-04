# JSCB GitHub Dashboard

Dashboard GitHub Pages untuk menampilkan timeline gabungan **JPCB A + JPCB B** dari Google Spreadsheet.

## File
- `index.html` — halaman dashboard
- `style.css` — tampilan spreadsheet/timeline
- `app.js` — mengambil dan menampilkan data
- `GitHubAPI.gs` — contoh API Apps Script standalone (read-only)

## Penting
API pada `app.js` sudah diarahkan ke Web App yang digunakan pada proyek JSCB GITHUB API.

Jika deployment Apps Script diperbarui, URL Web App tetap dapat dipakai selama deployment yang sama diperbarui ke versi baru.

Dashboard hanya membaca data. Tidak ada fungsi di dashboard yang mengubah JPCB A, JPCB B, atau NOTIFIKASI.

## Struktur sumber
JPCB A dan JPCB B:
- Baris 2 = tanggal timeline
- Baris 3 = jam timeline
- Data mulai baris 4
- Kolom A = identitas unit
- Kolom B = tanggal masuk
- Kolom C = jam masuk
- Kolom D = target keluar
- Kolom E = jam target keluar
- Kolom F = ACTUAL PROSES
- Kolom G dan seterusnya = timeline

NOTIFIKASI dibaca dari sheet `NOTIFIKASI`.

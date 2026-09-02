/**
 * GitHubAPI.gs
 * ------------------------------------------------------------
 * API READ-ONLY untuk GitHub JSCB.
 *
 * PENTING:
 * - Script ini TIDAK mengubah JPCB A.
 * - Script ini TIDAK mengubah JPCB B.
 * - Script ini TIDAK mengubah NOTIFIKASI.
 * - Letakkan sebagai Apps Script project TERPISAH yang terhubung
 *   ke spreadsheet yang sama, agar tidak bentrok dengan doGet lama.
 */

const API_SHEETS = {
  A: 'JPCB A',
  B: 'JPCB B',
  NOTIFIKASI: 'NOTIFIKASI'
};

const API_CONFIG = {
  headerDateRow: 2,       // baris tanggal timeline
  headerTimeRow: 3,       // baris jam timeline
  timelineStartColumn: 7, // G = kolom timeline pertama
  dataStartRow: 4,
  maxColumns: 300,
  maxRows: 2000
};

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || 'all').toLowerCase();
    let result;

    if (action === 'board') {
      result = { ok: true, board: getBoardData() };
    } else if (action === 'notifications') {
      result = { ok: true, notifications: getNotificationData() };
    } else {
      result = {
        ok: true,
        board: getBoardData(),
        notifications: getNotificationData()
      };
    }

    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ ok: false, message: String(err && err.message || err) });
  }
}

function getBoardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const a = readJpcbSheet(ss.getSheetByName(API_SHEETS.A), 'JPCB A');
  const b = readJpcbSheet(ss.getSheetByName(API_SHEETS.B), 'JPCB B');

  // Gunakan header A sebagai header utama.
  // Jika kosong, gunakan B.
  const columns = a.columns.length ? a.columns : b.columns;

  return {
    columns: columns,
    units: a.units.concat(b.units)
  };
}

function readJpcbSheet(sheet, sheetName) {
  if (!sheet) return { columns: [], units: [] };

  const lastRow = Math.min(Math.max(sheet.getLastRow(), API_CONFIG.dataStartRow), API_CONFIG.maxRows);
  const lastColumn = Math.min(Math.max(sheet.getLastColumn(), API_CONFIG.timelineStartColumn), API_CONFIG.maxColumns);
  const numRows = lastRow;
  const numCols = lastColumn;

  const range = sheet.getRange(1, 1, numRows, numCols);
  const values = range.getValues();
  const display = range.getDisplayValues();

  const start = API_CONFIG.timelineStartColumn - 1;
  const dateRow = API_CONFIG.headerDateRow - 1;
  const timeRow = API_CONFIG.headerTimeRow - 1;

  const columns = [];
  for (let c = start; c < numCols; c++) {
    const dateValue = values[dateRow] ? values[dateRow][c] : '';
    const timeValue = values[timeRow] ? values[timeRow][c] : '';
    const dateLabel = display[dateRow] ? String(display[dateRow][c] || '').trim() : '';
    const timeLabel = display[timeRow] ? normalizeTime(display[timeRow][c], timeValue) : normalizeTime('', timeValue);

    // Timeline dianggap valid jika tanggal atau jam terisi.
    if (!dateLabel && !timeLabel) continue;

    const dateKey = normalizeDateKey(dateValue, dateLabel);
    const dayLabel = dayNameId(dateValue, dateLabel);

    columns.push({
      key: dateKey + ' ' + timeLabel,
      dateKey: dateKey,
      dateLabel: dateLabel,
      timeLabel: timeLabel,
      dayLabel: dayLabel,
      sourceColumn: c + 1
    });
  }

  const units = [];
  for (let r = API_CONFIG.dataStartRow - 1; r < numRows; r++) {
    const rowDisplay = display[r] || [];
    const rowValues = values[r] || [];

    if (!looksLikeVehicleRow(rowDisplay, rowValues, start)) continue;

    const wo = firstNonEmpty(rowDisplay.slice(0, start), [
      /^(?:T?\d{6,})$/i
    ]);

    if (!wo) continue;

    const nopol = findNopol(rowDisplay.slice(0, start));
    const vehicle = findVehicle(rowDisplay.slice(0, start));
    const color = findColor(rowDisplay.slice(0, start));
    const sa = findSA(rowDisplay.slice(0, start));
    const process = findProcess(rowDisplay.slice(0, start));
    const group = detectGroup(rowDisplay.slice(0, start), sheetName);

    const timeline = [];
    for (let i = 0; i < columns.length; i++) {
      const sourceColumn = columns[i].sourceColumn - 1;
      const value = rowDisplay[sourceColumn] !== undefined
        ? String(rowDisplay[sourceColumn]).trim()
        : '';
      timeline.push(normalizeTimelineValue(value, rowValues[sourceColumn]));
    }

    // Hilangkan baris kosong/rumus sampah yang bukan unit.
    if (!timeline.some(v => v !== '') && !vehicle && !nopol) continue;

    units.push({
      sheet: sheetName,
      group: group,
      wo: wo,
      nopol: nopol,
      vehicle: vehicle,
      color: color,
      sa: sa,
      process: process,
      timeline: timeline
    });
  }

  return { columns: columns, units: units };
}

function getNotificationData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(API_SHEETS.NOTIFIKASI);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();
  if (!values.length) return [];

  const headers = display[0].map(v => String(v || '').trim().toLowerCase());
  const index = {};
  headers.forEach((h, i) => index[normalizeHeader(h)] = i);

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const d = display[r];
    if (!d.some(v => String(v || '').trim())) continue;

    rows.push({
      waktu: getByHeader(d, index, ['waktunotifikasi', 'waktu']),
      id: getByHeader(d, index, ['idnotifikasi', 'id']),
      identitas: getByHeader(d, index, ['identitas']),
      wo: getByHeader(d, index, ['wo', 'nowo']),
      nopol: getByHeader(d, index, ['nopol']),
      kendaraan: getByHeader(d, index, ['kendaraan', 'vehicle', 'model']),
      group: getByHeader(d, index, ['group', 'grup']),
      dariProses: getByHeader(d, index, ['dariproses', 'dari']),
      keProses: getByHeader(d, index, ['keproses', 'ke']),
      jadwal: getByHeader(d, index, ['jadwal']),
      status: getByHeader(d, index, ['status']),
      sheet: getByHeader(d, index, ['sheet']),
      jenis: getByHeader(d, index, ['jenis'])
    });
  }

  rows.reverse();
  return rows;
}

function looksLikeVehicleRow(rowDisplay, rowValues, timelineStart) {
  const left = rowDisplay.slice(0, timelineStart).map(v => String(v || '').trim()).filter(Boolean);
  if (!left.length) return false;

  const joined = left.join(' ');
  // WO normal 6 digit atau T + 6/lebih digit.
  return /(^|\s)T?\d{6,}(\s|$)/i.test(joined);
}

function firstNonEmpty(cells, patterns) {
  for (let i = 0; i < cells.length; i++) {
    const value = String(cells[i] || '').trim();
    if (!value) continue;
    if (!patterns || patterns.some(p => p.test(value))) return value;
  }
  return '';
}

function findNopol(cells) {
  for (const raw of cells) {
    const v = String(raw || '').trim();
    if (/^[A-Z]{1,2}-[0-9]{1,4}-[A-Z]{1,4}$/i.test(v)) return v;
  }
  return '';
}

function findSA(cells) {
  const known = ['REZ', 'ACH', 'DNS', 'FAR', 'SA'];
  for (const raw of cells) {
    const v = String(raw || '').trim().toUpperCase();
    if (known.includes(v)) return v;
  }
  return '';
}

function findColor(cells) {
  const known = ['BLACK', 'WHITE', 'SILVER', 'GREY', 'GRAY', 'RED', 'BLUE', 'BROWN', 'GREEN', 'ORANGE', 'YELLOW'];
  for (const raw of cells) {
    const v = String(raw || '').trim().toUpperCase();
    if (known.includes(v)) return v;
  }
  return '';
}

function findVehicle(cells) {
  const known = [
    'AVANZA','XENIA','CALYA','RUSH','INNOVA','FORTUNER','RAIZE','ZENIX','AGYA','YARIS','YARIS CROSS',
    'HILUX','HILUX DC','VOXY','SIENTA','VELLFIRE','ALPHARD','COROLLA','VIOS','MAZDA','BR-V','BRIO'
  ];
  for (const raw of cells) {
    const v = String(raw || '').trim();
    if (known.some(k => v.toUpperCase().includes(k))) return v;
  }
  return '';
}

function findProcess(cells) {
  const known = ['PANEL REPAIR','PUTTY','SURFACER','MASKING','SPRAYING','POLES','REASSY','FINISHING','FI','WAITING FOR REPAIR'];
  for (const raw of cells) {
    const v = String(raw || '').trim();
    const u = v.toUpperCase();
    if (known.some(k => u === k || u.includes(k))) return v;
  }
  return '';
}

function detectGroup(cells, sheetName) {
  for (const raw of cells) {
    const v = String(raw || '').toUpperCase();
    if (/(^|[^A-Z])[- ]A-?($|[^A-Z])/.test(v) || /\bGRUP\s*A\b/.test(v)) return 'A';
    if (/(^|[^A-Z])[- ]B-?($|[^A-Z])/.test(v) || /\bGRUP\s*B\b/.test(v)) return 'B';
  }
  return /JPCB B/i.test(sheetName) ? 'B' : 'A';
}

function normalizeTimelineValue(displayValue, rawValue) {
  const s = String(displayValue || '').trim();
  if (!s) return '';
  const n = Number(s.replace(',', '.'));
  if (n >= 1 && n <= 7) return String(Math.trunc(n));
  return s;
}

function normalizeTime(displayValue, rawValue) {
  const s = String(displayValue || '').trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  if (rawValue instanceof Date) {
    return Utilities.formatDate(rawValue, Session.getScriptTimeZone() || 'Asia/Jakarta', 'HH:mm');
  }
  return s;
}

function normalizeDateKey(value, displayValue) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  const s = String(displayValue || '').trim();
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return year + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return s;
}

function dayNameId(value, displayValue) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Jakarta', 'EEEE');
  const key = normalizeDateKey(value, displayValue);
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getByHeader(row, index, names) {
  for (const name of names) {
    const i = index[normalizeHeader(name)];
    if (i !== undefined) return row[i] || '';
  }
  return '';
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

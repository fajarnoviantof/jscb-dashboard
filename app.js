/*
 * JSCB GITHUB
 * Frontend read-only.
 * Sumber: Apps Script JSON endpoint yang membaca JPCB A, JPCB B, NOTIFIKASI.
 */

const API_URL = "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";
const AUTO_REFRESH_MS = 60000;

let appData = { board: { columns: [], units: [] }, notifications: [] };
let currentGroup = "ALL";

const STAGE_NAMES = {
  1: "Panel Repair",
  2: "Putty / Surfacer",
  3: "Masking / Spraying",
  4: "Surfacer / Poles",
  5: "Masking / Reassy",
  6: "Spraying / Finishing",
  7: "FI / Final"
};

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(() => loadData(true), AUTO_REFRESH_MS);
  loadData(false);
});

function bindUI() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("page-" + btn.dataset.page).classList.add("active");
    });
  });

  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      currentGroup = btn.dataset.group;
      renderBoard();
    });
  });

  document.getElementById("searchInput").addEventListener("input", renderBoard);
  document.getElementById("refreshBtn").addEventListener("click", () => loadData(false));
  document.getElementById("refreshNotifBtn").addEventListener("click", () => loadData(false));
}

async function loadData(silent) {
  if (!API_URL || API_URL.includes("PASTE_APPS_SCRIPT")) {
    showError("API_URL belum diisi. Masukkan URL Web App Apps Script pada app.js.");
    return;
  }

  setLoading(true);
  try {
    const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "action=all&_=" + Date.now();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const json = await response.json();
    if (!json.ok) throw new Error(json.message || "API mengembalikan error");

    appData = normalizeApiData(json);
    renderBoard();
    renderNotifications();
    if (!silent) showToast("Data JSCB diperbarui");
  } catch (err) {
    console.error(err);
    showError("Gagal mengambil data: " + err.message);
  } finally {
    setLoading(false);
  }
}

function normalizeApiData(json) {
  const board = json.board || {};
  const columns = Array.isArray(board.columns) ? board.columns : [];
  const units = Array.isArray(board.units) ? board.units : [];
  const notifications = Array.isArray(json.notifications) ? json.notifications : [];

  return {
    board: { columns, units },
    notifications
  };
}

function renderBoard() {
  const boardEl = document.getElementById("board");
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const columns = appData.board.columns || [];

  let units = (appData.board.units || []).filter(unit => {
    const group = normalizeGroup(unit.group, unit.sheet);
    const groupOK = currentGroup === "ALL" || group === currentGroup;
    const text = [unit.wo, unit.nopol, unit.vehicle, unit.color, unit.sa, unit.process, unit.sheet, group]
      .map(cleanText).join(" ").toLowerCase();
    return groupOK && text.includes(search);
  });

  units.sort((a, b) => {
    const ga = normalizeGroup(a.group, a.sheet);
    const gb = normalizeGroup(b.group, b.sheet);
    if (ga !== gb) return ga.localeCompare(gb);
    return cleanText(a.wo).localeCompare(cleanText(b.wo), undefined, { numeric: true });
  });

  document.getElementById("summary").textContent = `${units.length} unit • JPCB A + JPCB B • ${columns.length} slot waktu`;

  if (!columns.length) {
    boardEl.innerHTML = `<div class="error">Header timeline belum ditemukan dari JPCB A / JPCB B.</div>`;
    return;
  }

  const dayGroups = groupColumnsByDate(columns);
  const nowKey = getCurrentSlotKey();

  let html = `<table class="timeline-table"><thead>`;

  html += `<tr class="day">
    <th class="left group-col" rowspan="3">GRUP</th>
    <th class="left identity-col" rowspan="3">IDENTITAS UNIT</th>
    <th class="left process-col" rowspan="3">ACTUAL PROSES</th>`;
  dayGroups.forEach(group => {
    html += `<th colspan="${group.count}">${escapeHtml(group.day)}</th>`;
  });
  html += `</tr>`;

  html += `<tr class="date">`;
  dayGroups.forEach(group => {
    group.columns.forEach(col => {
      html += `<th>${escapeHtml(col.dateLabel || "")}</th>`;
    });
  });
  html += `</tr>`;

  html += `<tr class="time">`;
  dayGroups.forEach(group => {
    group.columns.forEach(col => {
      const nowClass = col.key === nowKey ? " now" : "";
      html += `<th class="time-col${nowClass}">${escapeHtml(col.timeLabel || "")}</th>`;
    });
  });
  html += `</tr></thead><tbody>`;

  if (!units.length) {
    html += `<tr><td class="left" colspan="${columns.length + 3}" style="padding:25px;text-align:center">Tidak ada unit yang sesuai filter.</td></tr>`;
  } else {
    let previousGroup = null;
    units.forEach(unit => {
      const group = normalizeGroup(unit.group, unit.sheet);
      const separator = previousGroup && previousGroup !== group ? " group-separator" : "";
      previousGroup = group;
      html += `<tr class="${separator.trim()}">`;
      html += `<td class="left group-col group-cell ${group.toLowerCase()}">${escapeHtml(group)}</td>`;
      html += `<td class="left identity-col">
        <div class="identity">
          <span class="dot ${group.toLowerCase()}"></span>
          <span class="wo">${escapeHtml(unit.wo)}</span>
          <span class="detail">${escapeHtml(unit.nopol)} • ${escapeHtml(unit.vehicle)} • ${escapeHtml(unit.color || "")}</span>
        </div>
      </td>`;
      html += `<td class="left process-col process-cell">
        <span class="stage">${escapeHtml(unit.process || deriveProcess(unit))}</span>
        <span class="sheet">${escapeHtml(unit.sa || "")} ${unit.sheet ? "• " + escapeHtml(unit.sheet) : ""}</span>
      </td>`;

      const values = Array.isArray(unit.timeline) ? unit.timeline : [];
      columns.forEach((col, index) => {
        const value = values[index] ?? "";
        const cls = timelineClass(value, col);
        html += `<td class="timeline-cell time-col ${cls}" title="${escapeHtml(unit.wo)} • ${escapeHtml(col.dateLabel || "")} ${escapeHtml(col.timeLabel || "")}">${escapeHtml(value)}</td>`;
      });
      html += `</tr>`;
    });
  }

  html += `</tbody></table>`;
  boardEl.innerHTML = html;
}

function renderNotifications() {
  const box = document.getElementById("notifications");
  const list = appData.notifications || [];
  document.getElementById("notifBadge").textContent = list.length;

  if (!list.length) {
    box.innerHTML = `<div class="loading">Belum ada data pada sheet NOTIFIKASI.</div>`;
    return;
  }

  box.innerHTML = list.map(n => {
    const status = cleanText(n.status);
    const statusClass = /selesai|done|closed|read/i.test(status) ? "status-ok" : /open|baru|pending/i.test(status) ? "status-open" : "status-other";
    return `<div class="notice">
      <div class="notice-time">${escapeHtml(formatDateTime(n.waktu || n.time))}</div>
      <div class="notice-main">
        <strong>WO ${escapeHtml(n.wo)}${n.nopol ? " — " + escapeHtml(n.nopol) : ""}</strong>
        <span>${escapeHtml(n.kendaraan || n.vehicle || "")} • ${escapeHtml(n.sheet || "")} • Grup ${escapeHtml(n.group || normalizeGroup("", n.sheet))}</span>
      </div>
      <div class="notice-next">${escapeHtml(n.dariProses || n.from || "-")} → ${escapeHtml(n.keProses || n.to || "-")} ${n.jadwal ? "• " + escapeHtml(n.jadwal) : ""}</div>
      <div class="notice-status ${statusClass}">${escapeHtml(status || "-")}</div>
    </div>`;
  }).join("");
}

function groupColumnsByDate(columns) {
  const groups = [];
  columns.forEach(col => {
    const key = col.dateKey || col.dateLabel || "";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, day: col.dayLabel || dayNameFromDate(col.dateKey), count: 0, columns: [] };
      groups.push(group);
    }
    group.columns.push(col);
    group.count++;
  });
  return groups;
}

function timelineClass(value, col) {
  const text = cleanText(value);
  if (!text) {
    if (isLunch(col.timeLabel)) return "blank lunch";
    return "blank";
  }
  const number = Number(text);
  if (number >= 1 && number <= 7) return "v" + number;
  return "blank";
}

function isLunch(time) {
  return cleanText(time) === "12:00";
}

function deriveProcess(unit) {
  const values = Array.isArray(unit.timeline) ? unit.timeline : [];
  let last = "";
  values.forEach(v => { if (Number(v) >= 1 && Number(v) <= 7) last = Number(v); });
  return STAGE_NAMES[last] || "-";
}

function normalizeGroup(group, sheet) {
  const g = cleanText(group).toUpperCase();
  if (g === "A" || g === "B") return g;
  const s = cleanText(sheet).toUpperCase();
  if (s.includes("JPCB A")) return "A";
  if (s.includes("JPCB B")) return "B";
  return "-";
}

function cleanText(value) {
  return String(value ?? "").replace(/^'+|'+$/g, "").replace(/^"+|"+$/g, "").trim();
}

function dayNameFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(date);
}

function getCurrentSlotKey() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return `${date} ${time}:00`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function setLoading(on) {
  const btn = document.getElementById("refreshBtn");
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? "… Memuat" : "↻ Refresh";
  }
}

function updateClock() {
  document.getElementById("clock").textContent = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(new Date());
}

function showError(message) {
  document.getElementById("board").innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
  document.getElementById("summary").textContent = "Data belum tersedia";
}

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.style.display = "none", 2500);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

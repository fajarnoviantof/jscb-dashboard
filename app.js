/*
 * JSCB GitHub Frontend
 * ---------------------------------------------
 * Tidak mengubah JPCB A / JPCB B yang sekarang.
 *
 * Untuk tahap prototype, data demo aktif.
 * Nanti DEMO_DATA dapat diganti dengan endpoint
 * pembacaan data yang sudah ada.
 */

const API_URL = ""; // isi jika nanti tersedia endpoint JSON

const DEMO_DATA = [
  {sheet:"JPCB A", wo:"T2608352", nopol:"G-1532-FF", vehicle:"CALYA", color:"BLACK", process:"Reassy", stage:5},
  {sheet:"JPCB A", wo:"2609013", nopol:"G-1534-YQ", vehicle:"XENIA", color:"WHITE", process:"Panel Repair", stage:1},
  {sheet:"JPCB A", wo:"T2608257", nopol:"G-1-HNL", vehicle:"HILUX DC", color:"WHITE", process:"Reassy", stage:5},
  {sheet:"JPCB A", wo:"2608302", nopol:"G-1185-IJ", vehicle:"RUSH", color:"WHITE", process:"Spraying", stage:3},
  {sheet:"JPCB A", wo:"2608290", nopol:"B-94-MAO", vehicle:"INNOVA", color:"SILVER", process:"Masking", stage:3},
  {sheet:"JPCB A", wo:"2608275", nopol:"G-210-YY", vehicle:"FORTUNER", color:"BLACK", process:"Spraying", stage:3},

  {sheet:"JPCB B", wo:"2608277", nopol:"G-1215-RQ", vehicle:"RAIZE", color:"GREY", process:"Panel Repair", stage:1},
  {sheet:"JPCB B", wo:"2608301", nopol:"B-2158-FKX", vehicle:"AVANZA", color:"SILVER", process:"Putty", stage:2},
  {sheet:"JPCB B", wo:"2608305", nopol:"G-444-NIN", vehicle:"INNOVA", color:"BLACK", process:"Spraying", stage:3},
  {sheet:"JPCB B", wo:"2609002", nopol:"G-1365-BJ", vehicle:"AVANZA", color:"SILVER", process:"Panel Repair", stage:1},
  {sheet:"JPCB B", wo:"2609003", nopol:"G-1647-DF", vehicle:"CALYA", color:"BLACK", process:"Masking", stage:3},
  {sheet:"JPCB B", wo:"2609008", nopol:"G-1286-PJ", vehicle:"ZENIX", color:"BLACK", process:"Panel Repair", stage:1}
];

const STAGES = [
  "Panel Repair",
  "Putty / Surfacer",
  "Masking / Spraying",
  "Poles",
  "Reassy",
  "Finishing",
  "FI"
];

let vehicles = [];
let currentGroup = "ALL";

document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  updateClock();
  setInterval(updateClock, 1000);
  loadData();
});

function bindUI(){
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
  document.getElementById("refreshBtn").addEventListener("click", loadData);
  document.getElementById("clearDemoBtn").addEventListener("click", () => {
    localStorage.removeItem("jscb_notifications");
    renderNotifications();
    showToast("Daftar demo dibersihkan");
  });
}

async function loadData(){
  try{
    if(API_URL){
      const response = await fetch(API_URL, {cache:"no-store"});
      if(!response.ok) throw new Error("API gagal");
      vehicles = await response.json();
    }else{
      vehicles = structuredClone(DEMO_DATA);
    }
    renderBoard();
    renderNotifications();
  }catch(err){
    vehicles = structuredClone(DEMO_DATA);
    renderBoard();
    showToast("API belum tersedia — menggunakan data demo");
  }
}

function renderBoard(){
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const filtered = vehicles.filter(v => {
    const groupOK = currentGroup === "ALL" || v.sheet.endsWith(currentGroup);
    const text = `${v.wo} ${v.nopol} ${v.vehicle} ${v.color} ${v.process} ${v.sheet}`.toLowerCase();
    return groupOK && text.includes(search);
  });

  document.getElementById("summary").textContent =
    `${filtered.length} unit ditampilkan • JPCB A + JPCB B`;

  const board = document.getElementById("board");
  board.innerHTML = "";

  STAGES.forEach((stage, index) => {
    const col = document.createElement("div");
    col.className = "column";
    const items = filtered.filter(v => Number(v.stage) === index + 1);

    col.innerHTML = `
      <div class="column-title">
        ${stage}
        <small>${items.length} unit</small>
      </div>
    `;

    if(!items.length){
      col.innerHTML += `<div class="empty">Tidak ada unit</div>`;
    }else{
      items.forEach(v => {
        const card = document.createElement("div");
        card.className = `vehicle ${v.sheet.endsWith("A") ? "a" : "b"}`;
        card.innerHTML = `
          <div class="wo">${escapeHtml(v.wo)}</div>
          <div class="nopol">${escapeHtml(v.nopol)}</div>
          <div class="meta">
            ${escapeHtml(v.vehicle)} • ${escapeHtml(v.color)}<br>
            ${escapeHtml(v.sheet)}
          </div>
          <span class="process">${escapeHtml(v.process)}</span>
        `;
        col.appendChild(card);
      });
    }
    board.appendChild(col);
  });
}

function renderNotifications(){
  const box = document.getElementById("notifications");
  const list = JSON.parse(localStorage.getItem("jscb_notifications") || "[]");

  if(!list.length){
    box.innerHTML = `<div class="empty">Belum ada notifikasi tersimpan.</div>`;
    return;
  }

  box.innerHTML = list.map(n => `
    <div class="notice">
      <div class="notice-time">${escapeHtml(n.time)}</div>
      <div class="notice-main">
        <strong>WO ${escapeHtml(n.wo)} — ${escapeHtml(n.nopol)}</strong>
        <span>${escapeHtml(n.sheet)} • ${escapeHtml(n.vehicle)}</span>
      </div>
      <div class="notice-next">${escapeHtml(n.from)} → ${escapeHtml(n.to)}</div>
    </div>
  `).join("");
}

function updateClock(){
  const now = new Date();
  document.getElementById("clock").textContent =
    new Intl.DateTimeFormat("id-ID", {
      timeZone:"Asia/Jakarta",
      day:"2-digit",month:"2-digit",year:"numeric",
      hour:"2-digit",minute:"2-digit",second:"2-digit",
      hour12:false
    }).format(now);
}

function showToast(message){
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.style.display = "none", 3500);
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

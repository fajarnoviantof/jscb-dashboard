const API_URL = 'https://script.google.com/macros/s/AKfycbwiSMC42T0njf7NYPCAtKzqepEd1Cthm2tLiBkzeDKMvG_UqsJ60Kz8LdL2nazCvvEstg/exec';

let state = { board:null, notifications:[], filter:'ALL', search:'' };

const $ = id => document.getElementById(id);

function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function clean(v){ return String(v ?? '').replace(/^"+|"+$/g,'').trim(); }
function parseDate(s){
  const m=clean(s).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/); if(!m)return null;
  let y=+m[3]; if(y<100)y+=2000; return new Date(y,+m[2]-1,+m[1]);
}
function parseTime(s){const m=clean(s).match(/^(\d{1,2}):(\d{2})/);return m?(+m[1]*60 + +m[2]):9999}
function colKey(c){return `${clean(c.date)}|${clean(c.time)}`}
function dayName(date){return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][date.getDay()]}
function dateSort(c){const d=parseDate(c.date);return d?d.getTime()*10000+parseTime(c.time):Number.MAX_SAFE_INTEGER}

async function loadData(){
  setStatus('Memuat data dari JPCB A + JPCB B...');
  try{
    const url = API_URL + '?action=all&t=' + Date.now();
    const res = await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'API mengembalikan error');
    state.board=data.board||{columns:[],units:[]};
    state.notifications=Array.isArray(data.notifications)?data.notifications:[];
    renderAll();
    setStatus(`Data berhasil dimuat: ${state.board.units.length} unit`);
  }catch(err){
    state.board={columns:[],units:[]}; state.notifications=[]; renderAll();
    setStatus('GAGAL MEMUAT DATA: '+err.message);
  }
}

function setStatus(t){ $('status').textContent=t; }
function filteredUnits(){
  const units=state.board?.units||[];
  const q=state.search.toLowerCase();
  return units.filter(u=>{
    const f=state.filter==='ALL'||u.source===state.filter;
    const hay=[u.source,u.identity,u.actualProcess,u.tglIn,u.jamIn,u.tgtOut,u.jamOut].join(' ').toLowerCase();
    return f && (!q||hay.includes(q));
  });
}

function renderAll(){
  renderSummary(); renderBoard(); renderNotifications(); updateClock();
  $('updatedAt').textContent=new Date().toLocaleTimeString('id-ID',{hour12:false});
}
function renderSummary(){
  const units=state.board?.units||[];
  $('totalUnit').textContent=units.length;
  $('totalA').textContent=units.filter(x=>x.source==='JPCB A').length;
  $('totalB').textContent=units.filter(x=>x.source==='JPCB B').length;
  $('totalNotif').textContent=state.notifications.length;
  $('notifBadge').textContent=state.notifications.length;
}

function renderBoard(){
  const el=$('board'); const units=filteredUnits();
  const sourceCols=(state.board?.columns||[]).map((c,i)=>({...c,_i:i}));
  if(!sourceCols.length || !units.length){
    el.style.removeProperty('--timeline-cols');
    el.innerHTML=`<div class="empty">${sourceCols.length?'Tidak ada unit yang sesuai filter.':'Tidak ada data timeline dari API.'}</div>`;return;
  }
  // Merge identical date/time headers from A+B, preserving chronological order.
  const master=[]; const seen=new Set();
  sourceCols.sort((a,b)=>dateSort(a)-dateSort(b));
  sourceCols.forEach(c=>{const k=colKey(c);if(!seen.has(k)){seen.add(k);master.push(c)}});
  el.style.setProperty('--timeline-cols',`repeat(${master.length},65px)`);

  const html=[];
  html.push(headerRow('day-row', buildDayHeader(master)));
  html.push(headerRow('date-row', buildDateHeader(master)));
  html.push(headerRow('time-row', buildTimeHeader(master)));
  units.forEach(u=>html.push(unitRow(u,master)));
  el.innerHTML=html.join('');
}
function headerRow(cls, cells){return `<div class="board-row ${cls}">${cells}</div>`}
function buildLeft(text,cl=''){return `<div class="board-cell ${cl} corner">${text}</div>`}
function buildDayHeader(cols){
  let out=buildLeft('','left-head')+buildLeft('IDENTITAS UNIT','left-head-2')+buildLeft('ACTUAL PROSES','left-head-3');
  let i=0; while(i<cols.length){let d=parseDate(cols[i].date);let name=d?dayName(d):'';let j=i+1;while(j<cols.length&&clean(cols[j].date)===clean(cols[i].date))j++;out+=`<div class="board-cell day" style="grid-column:span ${j-i}">${esc(name)}</div>`;i=j} return out;
}
function buildDateHeader(cols){
  let out=buildLeft('','left-head')+buildLeft('','left-head-2')+buildLeft('','left-head-3');
  cols.forEach((c,i)=>{out+=`<div class="board-cell date ${isDayEnd(cols,i)?'day-end':''}">${esc(c.date)}</div>`});return out;
}
function buildTimeHeader(cols){
  let out=buildLeft('','left-head')+buildLeft('','left-head-2')+buildLeft('','left-head-3');
  cols.forEach((c,i)=>{const lunch=isLunch(c.time);out+=`<div class="board-cell time ${lunch?'lunch':''} ${isDayEnd(cols,i)?'day-end':''}">${esc(c.time)}</div>`});return out;
}
function isLunch(time){const m=parseTime(time);return m>=12*60&&m<13*60}
function isDayEnd(cols,i){return i===cols.length-1 || clean(cols[i+1].date)!==clean(cols[i].date)}
function sourceIndexMap(unit){
  const map=new Map();
  const cols=state.board.columns||[];
  cols.forEach((c,i)=>{if(c.source===unit.source)map.set(colKey(c),i)});return map;
}
function unitRow(u,master){
  const map=sourceIndexMap(u); const sourceClass=u.source==='JPCB A'?'source-a':'source-b';
  let out=`<div class="board-row">`;
  out+=`<div class="board-cell left-cell-1 unit ${sourceClass}">${esc(u.source.replace('JPCB ',''))}</div>`;
  out+=`<div class="board-cell left-cell-2 unit">${esc(u.identity)}</div>`;
  out+=`<div class="board-cell left-cell-3 actual">${esc(u.actualProcess)}</div>`;
  master.forEach((c,i)=>{
    const idx=map.get(colKey(c)); const val=idx===undefined?'':clean((u.timeline||[])[idx]);
    let cls='timeline-cell '+(isLunch(c.time)?'lunch ':'');
    if(/^\d$/.test(val)) cls+='p'+val; else if(val) cls+='text-timeline';
    if(isDayEnd(master,i))cls+=' day-end';
    out+=`<div class="board-cell ${cls}">${esc(val)}</div>`;
  });
  out+='</div>';return out;
}

function renderNotifications(){
  const el=$('notifications'), rows=state.notifications||[];
  if(!rows.length){el.innerHTML='<div class="empty">Tidak ada notifikasi.</div>';return}
  el.innerHTML=rows.slice().reverse().map((r,i)=>{
    const entries=Object.entries(r).filter(([,v])=>clean(v)!=='');
    const title=entries.length?entries[0][1]:'Notifikasi '+(i+1);
    return `<div class="notif-card"><strong>${esc(title)}</strong>${entries.slice(1).map(([k,v])=>`<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>`;
  }).join('');
}
function updateClock(){ $('clock').textContent=new Date().toLocaleString('id-ID',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }

$('refreshBtn').addEventListener('click',loadData);$('refreshNotifBtn').addEventListener('click',loadData);
$('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderBoard()});
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;renderBoard()}));
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');const page=b.dataset.page;$('boardPage').classList.toggle('active',page==='board');$('notificationsPage').classList.toggle('active',page==='notifications')}));
setInterval(updateClock,1000);setInterval(loadData,60000);updateClock();loadData();

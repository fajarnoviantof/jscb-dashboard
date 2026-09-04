/* =========================================================
   JSCB GITHUB DASHBOARD
   JPCB A + JPCB B
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbwiSMC42T0njf7NYPCAtKzqepEd1Cthm2tLiBkzeDKMvG_UqsJ60Kz8LdL2nazCvvEstg/exec";


const REFRESH_INTERVAL = 60000;


/* =========================================================
   STATE
========================================================= */

let state = {

  board: {
    columns: [],
    units: []
  },

  notifications: [],

  filter: "ALL",

  search: "",

  loading: false

};


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupTabs();

    setupFilters();

    setupSearch();

    setupRefresh();

    updateClock();

    setInterval(
      updateClock,
      1000
    );

    loadData();

    setInterval(
      loadData,
      REFRESH_INTERVAL
    );

  }
);


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

  if (state.loading) {
    return;
  }

  state.loading = true;

  setStatus(
    "Mengambil data dari JPCB A + JPCB B..."
  );

  try {

    const response = await fetch(
      API_URL +
      "?action=all&_=" +
      Date.now(),
      {
        method: "GET",
        cache: "no-store"
      }
    );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.error ||
        "API mengembalikan error"
      );

    }


    state.board =
      normalizeBoard(
        data.board
      );


    state.notifications =
      Array.isArray(
        data.notifications
      )
        ? data.notifications
        : [];


    renderAll();


    setStatus(
      "Data terakhir diperbarui " +
      formatTime(new Date())
    );


  } catch (error) {

    console.error(
      "Gagal mengambil API:",
      error
    );


    setStatus(
      "Gagal mengambil data: " +
      error.message
    );


  } finally {

    state.loading = false;

  }

}


/* =========================================================
   NORMALIZE BOARD
========================================================= */

function normalizeBoard(board) {

  if (!board) {

    return {
      columns: [],
      units: []
    };

  }


  const columns =
    Array.isArray(board.columns)
      ? board.columns
      : [];


  const units =
    Array.isArray(board.units)
      ? board.units
      : [];


  /*
    API mengirim timeline A dan B.
    Kita buat timeline master berdasarkan
    kombinasi tanggal + jam.
  */

  const masterMap =
    new Map();


  columns.forEach(
    column => {

      const key =
        makeColumnKey(
          column.date,
          column.time
        );


      if (!masterMap.has(key)) {

        masterMap.set(
          key,
          {
            date: column.date || "",
            time: column.time || "",
            key: key
          }
        );

      }

    }
  );


  const masterColumns =
    Array.from(
      masterMap.values()
    );


  /*
    Simpan pemetaan kolom berdasarkan source.
  */

  const sourceMaps = {};


  ["JPCB A", "JPCB B"].forEach(
    source => {

      sourceMaps[source] = {};

      columns.forEach(
        (column, index) => {

          if (
            column.source !== source
          ) {
            return;
          }


          const key =
            makeColumnKey(
              column.date,
              column.time
            );


          if (
            sourceMaps[source][key] === undefined
          ) {

            sourceMaps[source][key] =
              index -
              getSourceStartIndex(
                columns,
                source
              );

          }

        }
      );

    }
  );


  /*
    Lebih aman: buat daftar kolom timeline
    masing-masing source secara berurutan.
  */

  const sourceColumns = {};

  ["JPCB A", "JPCB B"].forEach(
    source => {

      sourceColumns[source] =
        columns.filter(
          column =>
            column.source === source
        );

    }
  );


  /*
    Mapping timeline unit ke master column.
  */

  const normalizedUnits =
    units.map(
      unit => {

        const source =
          unit.source || "";


        const ownColumns =
          sourceColumns[source] || [];


        const ownTimeline =
          Array.isArray(
            unit.timeline
          )
            ? unit.timeline
            : [];


        const timelineMap =
          {};


        ownColumns.forEach(
          (column, index) => {

            const key =
              makeColumnKey(
                column.date,
                column.time
              );


            timelineMap[key] =
              ownTimeline[index] || "";

          }
        );


        const timeline =
          masterColumns.map(
            column =>
              timelineMap[column.key] || ""
          );


        return {

          ...unit,

          timeline

        };

      }
    );


  return {

    columns: masterColumns,

    units: normalizedUnits

  };

}


/* =========================================================
   COLUMN KEY
========================================================= */

function makeColumnKey(
  date,
  time
) {

  return (
    String(date || "").trim() +
    "||" +
    String(time || "").trim()
  );

}


/* =========================================================
   SOURCE START INDEX
========================================================= */

function getSourceStartIndex(
  columns,
  source
) {

  const index =
    columns.findIndex(
      column =>
        column.source === source
    );


  return index < 0
    ? 0
    : index;

}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderSummary();

  renderBoard();

  renderNotifications();

}


/* =========================================================
   FILTER
========================================================= */

function getFilteredUnits() {

  let units =
    state.board.units || [];


  if (
    state.filter !== "ALL"
  ) {

    units =
      units.filter(
        unit =>
          unit.source ===
          state.filter
      );

  }


  const search =
    state.search
      .trim()
      .toLowerCase();


  if (search) {

    units =
      units.filter(
        unit => {

          const text =
            [
              unit.identity,
              unit.actualProcess,
              unit.tglIn,
              unit.jamIn,
              unit.tgtOut,
              unit.jamOut,
              unit.source
            ]
              .join(" ")
              .toLowerCase();


          return text.includes(
            search
          );

        }
      );

  }


  return units;

}


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  const units =
    state.board.units || [];


  const total =
    units.length;


  const totalA =
    units.filter(
      unit =>
        unit.source === "JPCB A"
    ).length;


  const totalB =
    units.filter(
      unit =>
        unit.source === "JPCB B"
    ).length;


  const totalNotifications =
    state.notifications.length;


  setText(
    "totalUnits",
    total
  );


  setText(
    "totalA",
    totalA
  );


  setText(
    "totalB",
    totalB
  );


  setText(
    "totalNotifications",
    totalNotifications
  );


  const badge =
    document.getElementById(
      "notificationBadge"
    );


  if (
    totalNotifications > 0
  ) {

    badge.textContent =
      totalNotifications;

    badge.classList.remove(
      "hidden"
    );

  } else {

    badge.classList.add(
      "hidden"
    );

  }

}


/* =========================================================
   RENDER BOARD
========================================================= */

function renderBoard() {

  const board =
    document.getElementById(
      "timelineBoard"
    );


  const columns =
    state.board.columns || [];


  const units =
    getFilteredUnits();


  board.innerHTML = "";


  if (
    columns.length === 0
  ) {

    board.innerHTML = `
      <div class="empty-board">
        Tidak ada data timeline.
      </div>
    `;

    return;

  }


  board.style.setProperty(
    "--timeline-count",
    columns.length
  );


  /*
    HEADER
  */

  renderHeader(
    board,
    columns
  );


  /*
    DATA
  */

  if (
    units.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty-board";


    empty.textContent =
      "Tidak ada unit yang sesuai filter.";


    board.appendChild(
      empty
    );


    return;

  }


  units.forEach(
    unit => {

      renderUnitRow(
        board,
        unit,
        columns
      );

    }
  );

}


/* =========================================================
   HEADER
========================================================= */

function renderHeader(
  board,
  columns
) {

  /*
    BARIS 1
    HARI
  */

  const dayRow =
    createTimelineRow(
      "timeline-header"
    );


  addHeaderFixedCells(
    dayRow,
    "Hari"
  );


  let previousDay = "";


  columns.forEach(
    column => {

      const cell =
        createCell(
          "cell header-day"
        );


      const day =
        getDayName(
          column.date
        );


      if (
        day !== previousDay
      ) {

        cell.textContent =
          day;

        previousDay =
          day;

      } else {

        cell.textContent =
          "";

      }


      dayRow.appendChild(
        cell
      );

    }
  );


  board.appendChild(
    dayRow
  );


  /*
    BARIS 2
    TANGGAL
  */

  const dateRow =
    createTimelineRow(
      "timeline-header"
    );


  addHeaderFixedCells(
    dateRow,
    "Tanggal"
  );


  columns.forEach(
    column => {

      const cell =
        createCell(
          "cell header-date"
        );


      cell.textContent =
        column.date || "";


      dateRow.appendChild(
        cell
      );

    }
  );


  board.appendChild(
    dateRow
  );


  /*
    BARIS 3
    JAM
  */

  const timeRow =
    createTimelineRow(
      "timeline-header"
    );


  addHeaderFixedCells(
    timeRow,
    "Jam"
  );


  columns.forEach(
    column => {

      const cell =
        createCell(
          "cell header-time"
        );


      cell.textContent =
        column.time || "";


      timeRow.appendChild(
        cell
      );

    }
  );


  board.appendChild(
    timeRow
  );

}


/* =========================================================
   FIXED HEADER CELLS
========================================================= */

function addHeaderFixedCells(
  row,
  firstLabel
) {

  const labels = [

    "GRUP",

    "IDENTITAS UNIT",

    "TGL IN",

    "JAM IN",

    "TGT OUT",

    "JAM OUT",

    "ACTUAL PROSES"

  ];


  labels.forEach(
    (label, index) => {

      const cell =
        createCell(
          "cell sticky-col"
        );


      if (
        index === 0
      ) {

        cell.classList.add(
          "col-group"
        );

      }

      if (
        index === 1
      ) {

        cell.classList.add(
          "col-identity"
        );

      }

      if (
        index === 2
      ) {

        cell.classList.add(
          "col-tgl-in"
        );

      }

      if (
        index === 3
      ) {

        cell.classList.add(
          "col-jam-in"
        );

      }

      if (
        index === 4
      ) {

        cell.classList.add(
          "col-tgt-out"
        );

      }

      if (
        index === 5
      ) {

        cell.classList.add(
          "col-jam-out"
        );

      }

      if (
        index === 6
      ) {

        cell.classList.add(
          "col-actual"
        );

      }


      cell.textContent =
        label;


      row.appendChild(
        cell
      );

    }
  );

}


/* =========================================================
   UNIT ROW
========================================================= */

function renderUnitRow(
  board,
  unit,
  columns
) {

  const row =
    createTimelineRow();


  const sourceClass =
    unit.source === "JPCB A"
      ? "source-a"
      : "source-b";


  /*
    GRUP
  */

  const groupCell =
    createCell(
      "cell sticky-col col-group " +
      sourceClass
    );


  groupCell.textContent =
    unit.source || "";


  row.appendChild(
    groupCell
  );


  /*
    IDENTITAS
  */

  const identityCell =
    createCell(
      "cell sticky-col col-identity identity-cell"
    );


  identityCell.title =
    unit.identity || "";


  identityCell.textContent =
    unit.identity || "";


  row.appendChild(
    identityCell
  );


  /*
    TGL IN
  */

  row.appendChild(
    createStickyCell(
      "col-tgl-in",
      unit.tglIn
    )
  );


  /*
    JAM IN
  */

  row.appendChild(
    createStickyCell(
      "col-jam-in",
      unit.jamIn
    )
  );


  /*
    TGT OUT
  */

  row.appendChild(
    createStickyCell(
      "col-tgt-out",
      unit.tgtOut
    )
  );


  /*
    JAM OUT
  */

  row.appendChild(
    createStickyCell(
      "col-jam-out",
      unit.jamOut
    )
  );


  /*
    ACTUAL PROSES
  */

  const actualCell =
    createCell(
      "cell sticky-col col-actual actual-cell"
    );


  actualCell.title =
    unit.actualProcess || "";


  actualCell.textContent =
    unit.actualProcess || "";


  row.appendChild(
    actualCell
  );


  /*
    TIMELINE
  */

  const timeline =
    Array.isArray(
      unit.timeline
    )
      ? unit.timeline
      : [];


  columns.forEach(
    (column, index) => {

      const value =
        timeline[index] || "";


      const cell =
        createCell(
          "cell timeline-cell"
        );


      cell.textContent =
        value;


      if (!value) {

        cell.classList.add(
          "empty-cell"
        );

      } else {

        const process =
          String(value).trim();


        if (
          /^[1-7]$/.test(process)
        ) {

          cell.classList.add(
            "process-" +
            process
          );

        } else {

          cell.classList.add(
            "text-cell"
          );

        }

      }


      if (value) {

        cell.title =
          String(value);

      }


      row.appendChild(
        cell
      );

    }
  );


  board.appendChild(
    row
  );

}


/* =========================================================
   CREATE ROW
========================================================= */

function createTimelineRow(
  extraClass = ""
) {

  const row =
    document.createElement(
      "div"
    );


  row.className =
    "timeline-row " +
    extraClass;


  return row;

}


/* =========================================================
   CREATE CELL
========================================================= */

function createCell(
  className
) {

  const cell =
    document.createElement(
      "div"
    );


  cell.className =
    className;


  return cell;

}


/* =========================================================
   STICKY CELL
========================================================= */

function createStickyCell(
  className,
  value
) {

  const cell =
    createCell(
      "cell sticky-col " +
      className
    );


  cell.textContent =
    value || "";


  return cell;

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function renderNotifications() {

  const container =
    document.getElementById(
      "notificationList"
    );


  container.innerHTML = "";


  const notifications =
    state.notifications || [];


  if (
    notifications.length === 0
  ) {

    container.innerHTML = `
      <div class="empty">
        Tidak ada notifikasi.
      </div>
    `;

    return;

  }


  notifications
    .slice()
    .reverse()
    .forEach(
      notification => {

        const card =
          document.createElement(
            "div"
          );


        card.className =
          "notification-card";


        const entries =
          Object.entries(
            notification
          );


        if (
          entries.length === 0
        ) {

          return;

        }


        const title =
          entries[0][1] ||
          "NOTIFIKASI";


        const titleEl =
          document.createElement(
            "div"
          );


        titleEl.className =
          "notification-card-title";


        titleEl.textContent =
          title;


        card.appendChild(
          titleEl
        );


        const body =
          document.createElement(
            "div"
          );


        body.className =
          "notification-card-body";


        entries
          .slice(1)
          .forEach(
            ([key, value]) => {

              if (
                !value
              ) {
                return;
              }


              const line =
                document.createElement(
                  "div"
                );


              line.innerHTML =
                `
                  <strong>
                    ${escapeHtml(key)}
                  </strong>
                  :
                  ${escapeHtml(value)}
                `;


              body.appendChild(
                line
              );

            }
          );


        card.appendChild(
          body
        );


        container.appendChild(
          card
        );

      }
    );

}


/* =========================================================
   TABS
========================================================= */

function setupTabs() {

  const tabs =
    document.querySelectorAll(
      ".tab"
    );


  tabs.forEach(
    tab => {

      tab.addEventListener(
        "click",
        () => {

          const page =
            tab.dataset.page;


          tabs.forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );


          tab.classList.add(
            "active"
          );


          document
            .querySelectorAll(
              ".page"
            )
            .forEach(
              section =>
                section.classList.remove(
                  "active"
                )
            );


          if (
            page === "board"
          ) {

            document
              .getElementById(
                "boardPage"
              )
              .classList.add(
                "active"
              );

          }


          if (
            page === "notifications"
          ) {

            document
              .getElementById(
                "notificationsPage"
              )
              .classList.add(
                "active"
              );

          }

        }
      );

    }
  );

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

  const buttons =
    document.querySelectorAll(
      ".filter-btn"
    );


  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          buttons.forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );


          button.classList.add(
            "active"
          );


          state.filter =
            button.dataset.filter;


          renderBoard();

        }
      );

    }
  );

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

  const input =
    document.getElementById(
      "searchInput"
    );


  input.addEventListener(
    "input",
    event => {

      state.search =
        event.target.value;


      renderBoard();

    }
  );

}


/* =========================================================
   REFRESH BUTTON
========================================================= */

function setupRefresh() {

  document
    .getElementById(
      "refreshBtn"
    )
    .addEventListener(
      "click",
      loadData
    );


  document
    .getElementById(
      "refreshNotificationBtn"
    )
    .addEventListener(
      "click",
      loadData
    );

}


/* =========================================================
   CLOCK
========================================================= */

function updateClock() {

  const now =
    new Date();


  const el =
    document.getElementById(
      "clock"
    );


  if (!el) {
    return;
  }


  el.textContent =
    now.toLocaleString(
      "id-ID",
      {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    );

}


/* =========================================================
   DAY NAME
========================================================= */

function getDayName(
  dateText
) {

  if (!dateText) {
    return "";
  }


  const date =
    parseSheetDate(
      dateText
    );


  if (!date) {
    return "";
  }


  return date.toLocaleDateString(
    "id-ID",
    {
      weekday: "long"
    }
  );

}


/* =========================================================
   PARSE DATE
========================================================= */

function parseSheetDate(
  text
) {

  const value =
    String(text)
      .trim();


  /*
    Format umum:
    11/8/26
    26/8/26
  */

  const parts =
    value.split("/");


  if (
    parts.length !== 3
  ) {

    return null;

  }


  let day =
    Number(parts[0]);


  let month =
    Number(parts[1]);


  let year =
    Number(parts[2]);


  if (
    !day ||
    !month ||
    !year
  ) {

    return null;

  }


  if (
    year < 100
  ) {

    year += 2000;

  }


  return new Date(
    year,
    month - 1,
    day
  );

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text
) {

  const el =
    document.getElementById(
      "status"
    );


  if (el) {

    el.textContent =
      text;

  }

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
  id,
  value
) {

  const el =
    document.getElementById(
      id
    );


  if (el) {

    el.textContent =
      value;

  }

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(
  date
) {

  return date.toLocaleTimeString(
    "id-ID",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}

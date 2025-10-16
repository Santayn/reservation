// plan-page.js
// Подсветка заполняемости аудиторий + вся инициализация страницы.

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  ready(async () => {
    window.SchedulePanel?.init?.();
    initFloorSwitch();
    initFilterMenu();
    await initSlots();
    initDates();
    initRooms();
    attachRefreshHandlers();
    refreshOccupancy(); // первичная заливка
  });

  // ===== Этажи =====
  function initFloorSwitch() {
    const buttons = $all(".floor-switch button");
    const floors = $all(".floor");

    const setFloor = (num) => {
      buttons.forEach(b => {
        const active = b.dataset.floor === String(num);
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      floors.forEach(f => f.classList.toggle("active", f.dataset.floor === String(num)));
    };
    buttons.forEach(b => b.addEventListener("click", () => setFloor(b.dataset.floor)));
  }

  // ===== Слоты =====
  async function initSlots() {
    const select = $("#slot-filter");
    const slots = await loadSlotsWithFallback();
    fillSelect(select, slots.map(s => ({ value: String(s.id), label: s.label })));
  }

  async function loadSlotsWithFallback() {
    try {
      const r = await fetch("/api/schedule/slots");
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length) {
          return data.map(s => ({
            id: s.id ?? s.slotId ?? s.slot_id ?? Math.random(),
            label: s.title || s.name || `${(s.start || "??")}–${(s.end || "??")}`
          }));
        }
      }
    } catch {}
    return [
      { id: 1, label: "08:30 – 10:00" },
      { id: 2, label: "10:10 – 11:40" },
      { id: 3, label: "11:50 – 13:20" },
      { id: 4, label: "14:00 – 15:30" },
      { id: 5, label: "15:40 – 17:10" }
    ];
  }

  // ===== Даты =====
  function initDates() {
    const start = $("#date-input");
    const end = $("#date-end-input");
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const todayStr = iso(new Date());
    if (start && !start.value) start.value = todayStr;
    if (end && !end.value) end.value = todayStr;
  }

  // ===== Фильтр =====
  function initFilterMenu() {
    const btn = $("#filter-btn");
    const menu = $("#filter-menu");
    const apply = $("#flt-apply");
    const clear = $("#flt-clear");
    const facultySel = $("#flt-faculty");
    const specSel = $("#flt-spec");

    loadFaculties().then(list => fillSelect(facultySel, [{value:"",label:"Все факультеты"}, ...list]));
    loadSpecs().then(list => fillSelect(specSel, [{value:"",label:"Все специализации"}, ...list]));

    btn.addEventListener("click", () => menu.classList.toggle("open"));

    apply.addEventListener("click", () => {
      const fac = facultySel.value;
      const rooms = $all(".room");
      rooms.forEach(r => {
        const wing = r.closest(".wing");
        let wingFac = "";
        if (wing?.classList.contains("center")) wingFac = "";
        else {
          const title = wing?.querySelector("h3")?.textContent || "";
          wingFac = title.includes("Правый") ? "facB" : "facA";
        }
        const matchFac = !fac || !wingFac || wingFac === fac;
        r.classList.toggle("filter-hit", matchFac);
        r.classList.toggle("dim", !matchFac);
      });
      menu.classList.remove("open");
    });

    clear.addEventListener("click", () => {
      facultySel.value = "";
      specSel.value = "";
      $all(".room").forEach(r => r.classList.remove("filter-hit", "dim"));
      menu.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove("open");
    });
  }

  async function loadFaculties() {
    try {
      const r = await fetch("/api/faculties?size=1000");
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      return arr.map(f => ({ value: String(f.id), label: f.name || f.title || `Факультет ${f.id}` }));
    } catch {
      return [
        { value: "facA", label: "Факультет А" },
        { value: "facB", label: "Факультет Б" }
      ];
    }
  }
  async function loadSpecs() {
    try {
      const r = await fetch("/api/specializations?size=1000");
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      return arr.map(s => ({ value: String(s.id), label: s.name || s.title || `Спец. ${s.id}` }));
    } catch {
      return [
        { value: "spec1", label: "Специализация 1" },
        { value: "spec2", label: "Специализация 2" }
      ];
    }
  }

  // ===== Комнаты / клики =====
  function initRooms() {
    const rooms = $all(".room");
    rooms.forEach(btn => {
      if (btn.classList.contains("foyer")) return;
      btn.setAttribute("tabindex", "0");
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      });

      btn.addEventListener("click", () => {
        const roomName = btn.dataset.room || btn.textContent.trim();
        const capacity = Number(btn.dataset.capacity || 0);
        const floorEl = btn.closest(".floor");
        const floor = Number(floorEl?.dataset.floor || 1);

        const slotSel = $("#slot-filter");
        const slot = {
          id: Number(slotSel?.value || 0),
          label: slotSel?.selectedOptions?.[0]?.textContent || "—"
        };

        const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek: "", weekParityType: "ANY", timeZoneId: "Europe/Berlin" };
        if (!sched.dayOfWeek) {
          const dateStr = $("#date-input")?.value || "";
          sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
        }

        const classroomId = classroomIdFromRoom(roomName);

        $all(".room").forEach(r => r.classList.remove("selected"));
        btn.classList.add("selected");

        window.RoomDrawer.open({
          roomName, capacity, floor, slot,
          classroomId,
          dayOfWeek: sched.dayOfWeek,
          weekParityType: sched.weekParityType,
          timeZoneId: sched.timeZoneId
        });
      });
    });
  }

  // === Подсветка заполняемости ===
  async function refreshOccupancy() {
    const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek: "", weekParityType: "ANY", timeZoneId: "Europe/Berlin" };
    if (!sched.dayOfWeek) {
      const dateStr = $("#date-input")?.value || "";
      sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
    }

    const rooms = $all(".room");
    await Promise.all(rooms.map(async (btn) => {
      if (btn.classList.contains("foyer")) return;
      const roomName = btn.dataset.room || btn.textContent.trim();
      const capacity = Number(btn.dataset.capacity || 0);
      const classroomId = classroomIdFromRoom(roomName);
      try {
        const list = await fetchBookings(classroomId, sched.dayOfWeek, sched.weekParityType);
        paintRoom(btn, list.length, capacity);
      } catch {
        paintRoom(btn, 0, capacity);
      }
    }));
  }

  function paintRoom(btn, used, capacity) {
    btn.classList.remove("idle","ok","warn","danger","over");

    if (!capacity || used <= 0) {            // нет вместимости или нет занятости
      btn.classList.add("idle");
      return;
    }

    const ratio = used / capacity;           // сколько от вместимости занято

    if (ratio < 1.0) {                       // < 100%
      btn.classList.add("ok");
      return;
    }
    if (ratio < 1.25) {                      // < 125%
      btn.classList.add("warn");
      return;
    }
    if (ratio < 1.5) {                       // < 150%
      btn.classList.add("danger");
      return;
    }
    // >= 150% (строго "больше 150%" — попадают сюда ratio >= 1.5; при точном ==1.5 сюда)
    btn.classList.add("over");
  }

  async function fetchBookings(classroomId, dayOfWeek, weekParityType) {
    const params = new URLSearchParams({
      classroomId: String(classroomId),
      dayOfWeek: dayOfWeek || "",
      weekParityType: weekParityType || "ANY"
    });
    const r = await fetch(`/api/bookings/search?${params.toString()}`);
    if (!r.ok) return [];
    return r.json();
  }

  function attachRefreshHandlers() {
    $("#date-input")?.addEventListener("change", refreshOccupancy);
    $("#sch-weektype")?.addEventListener("change", refreshOccupancy);
    $("#sch-day")?.addEventListener("change", refreshOccupancy);
    $("#sch-tz")?.addEventListener("change", refreshOccupancy);
  }

  // ===== Утилиты =====
  function classroomIdFromRoom(roomName) {
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);
    let hash = 1000;
    for (let i = 0; i < roomName.length; i++) hash = (hash * 31 + roomName.charCodeAt(i)) >>> 0;
    return hash;
  }
  function fillSelect(select, items) {
    if (!select) return;
    select.innerHTML = "";
    for (const it of items) {
      const opt = document.createElement("option");
      opt.value = it.value;
      opt.textContent = it.label;
      select.appendChild(opt);
    }
  }

  // даём доступ дашборду к ручному ре-рендеру из других модулей
  window.planRefreshOccupancy = refreshOccupancy;
})();

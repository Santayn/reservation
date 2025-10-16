// plan-page.js
// Подсветка заполняемости аудиторий + инициализация (слоты только из БД).

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  // Кэш групп для подсчёта людей
  const groupsCache = { byId: new Map(), loaded: false };

  async function loadGroups() {
    if (groupsCache.loaded) return;
    try {
      const r = await fetch("/api/groups?size=1000");
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      groupsCache.byId = new Map(
        arr.map(g => [ Number(g.id), { id: g.id, personsCount: Number(g.personsCount ?? 0) } ])
      );
      groupsCache.loaded = true;
    } catch {
      groupsCache.byId = new Map();
      groupsCache.loaded = true;
    }
  }

  ready(async () => {
    window.SchedulePanel?.init?.();
    initFloorSwitch();
    initFilterMenu();
    await initSlots();            // ← тянем только из БД
    initDates();
    initRooms();
    await loadGroups();           // нужно для подсчёта людей
    attachRefreshHandlers();
    refreshOccupancy();
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

  // ===== Слоты (только БД) =====
  async function initSlots() {
    const select = $("#slot-filter");
    const slots = await loadSlotsFromApi(); // может вернуть пусто
    if (slots.length) {
      fillSelect(select, slots.map(s => ({ value: String(s.id), label: s.label })));
      select.disabled = false;
    } else {
      // если нет слотов — показываем заглушку в UI и блокируем селект
      select.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— нет слотов —";
      select.appendChild(opt);
      select.disabled = true;
    }
    select?.addEventListener("change", refreshOccupancy);
  }

  async function loadSlotsFromApi() {
    const r = await fetch("/api/schedule/slots");
    if (!r.ok) return [];
    const data = await r.json();
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map(s => {
      const id = s.id ?? s.slotId ?? s.slot_id;
      const start = s.startAt ?? s.start_at ?? s.start;
      const end = s.endAt ?? s.end_at ?? s.end;
      return { id, label: `${formatTime(start)} – ${formatTime(end)}` };
    }).filter(s => s.id != null);
  }

  function formatTime(isoLike) {
    if (!isoLike) return "??:??";
    const d = new Date(String(isoLike).replace(" ", "T"));
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
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
      return [];
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
      return [];
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

        const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek: "", weekParityType: "ANY" };
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
          weekParityType: sched.weekParityType
        });
      });
    });
  }

  // === Подсветка заполняемости (по людям) ===
  async function refreshOccupancy() {
    const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek: "", weekParityType: "ANY" };
    if (!sched.dayOfWeek) {
      const dateStr = $("#date-input")?.value || "";
      sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
    }
    const slotSel = $("#slot-filter");
    const slotId = Number(slotSel?.value || 0);

    const rooms = $all(".room");
    await Promise.all(rooms.map(async (btn) => {
      if (btn.classList.contains("foyer")) return;
      const roomName = btn.dataset.room || btn.textContent.trim();
      const capacity = Number(btn.dataset.capacity || 0);
      const classroomId = classroomIdFromRoom(roomName);
      try {
        const list = await fetchBookings(classroomId, sched.dayOfWeek, sched.weekParityType, slotId);
        const totalPersons = (list || []).reduce((sum, b) => {
          const g = groupsCache.byId.get(Number(b.groupId));
          return sum + (g ? Number(g.personsCount || 0) : 0);
        }, 0);
        paintRoom(btn, totalPersons, capacity);
      } catch {
        paintRoom(btn, 0, capacity);
      }
    }));
  }

  // Легенда: пусто | ≤100% | до +25% | до +50% | > +50%
  function paintRoom(btn, usedPersons, capacity) {
    btn.classList.remove("idle","ok","warn","danger","over");

    if (!capacity || usedPersons <= 0) { btn.classList.add("idle"); return; }

    const ratio = usedPersons / capacity;
    if (ratio <= 1.0)  { btn.classList.add("ok");     return; } // ≤100%
    if (ratio <= 1.25) { btn.classList.add("warn");   return; } // до +25%
    if (ratio <= 1.5)  { btn.classList.add("danger"); return; } // до +50%
    btn.classList.add("over");                                   // > +50%
  }

  async function fetchBookings(classroomId, dayOfWeek, weekParityType, slotId) {
    const params = new URLSearchParams({
      classroomId: String(classroomId),
      dayOfWeek: dayOfWeek || "",
      weekParityType: weekParityType || "ANY",
      slotId: String(slotId || 0)
    });
    const r = await fetch(`/api/bookings/search?${params.toString()}`);
    if (!r.ok) return [];
    return r.json();
  }

  function attachRefreshHandlers() {
    $("#date-input")?.addEventListener("change", refreshOccupancy);
    $("#sch-weektype")?.addEventListener("change", refreshOccupancy);
    $("#sch-day")?.addEventListener("change", refreshOccupancy);
    $("#slot-filter")?.addEventListener("change", refreshOccupancy);
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

  window.planRefreshOccupancy = refreshOccupancy;
})();

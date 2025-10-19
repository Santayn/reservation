// plan-page.js
// Подсветка заполняемости аудиторий + фильтры по факультету/спецу (метаданные из БД).

(function () {
  "use strict";

  const $    = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function ready(cb){ if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",cb,{once:true});} else cb(); }

  // ===== Глобальные кэши (расшарены для других модулей) =====
  const GroupsCache = window.GroupsCache || { byId:new Map(), loaded:false };
  const RoomsMeta   = window.RoomsMeta   || { byId:new Map(), byName:new Map(), loaded:false };

  async function loadGroups(){
    if (GroupsCache.loaded) return;
    try{
      const r = await fetch("/api/groups?size=1000", { credentials:"include" });
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      GroupsCache.byId = new Map(arr.map(g => [Number(g.id), {
        id:Number(g.id), personsCount:Number(g.personsCount||0)
      }]));
    } finally { GroupsCache.loaded = true; window.GroupsCache = GroupsCache; }
  }

  async function loadRoomsMeta(){
    if (RoomsMeta.loaded) return;
    try{
      const r = await fetch("/api/classrooms?size=1000", { credentials:"include" });
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      for (const c of arr){
        const id  = Number(c.id);
        const nm  = (c.name ?? "").toString().trim();
        const meta = {
          id,
          name: nm,
          floor: Number(c.floor ?? 0),
          corpus: c.corpus || c.building || "", // если есть в БД
          facultyIds: Array.isArray(c.facultyIds) ? c.facultyIds.map(Number) : [],
          specializationIds: Array.isArray(c.specializationIds) ? c.specializationIds.map(Number) : []
        };
        if (Number.isFinite(id)) RoomsMeta.byId.set(id, meta);
        if (nm) RoomsMeta.byName.set(nm, meta);
      }
    } finally { RoomsMeta.loaded = true; window.RoomsMeta = RoomsMeta; }
  }

  // ===== Кэш слотов =====
  const slotsMap = new Map(); // id -> {id,label}

  ready(async () => {
    window.SchedulePanel?.init?.();
    initFloorSwitch();
    await initSlots();
    initDates();
    initRooms();

    await Promise.all([loadGroups(), loadRoomsMeta()]); // нужно и для фильтров, и для подсветки

    initFilterMenu();
    attachRefreshHandlers();
    refreshOccupancy();
  });

  // ===== Этажи =====
  function initFloorSwitch() {
    const buttons = $all(".floor-switch button");
    const floors  = $all(".floor");
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

  // ===== Слоты (из БД) =====
  async function initSlots(){
    const select = $("#slot-filter");
    const slots  = await loadSlotsFromApi();
    if (slots.length){
      fillSelect(select, slots.map(s => ({value:String(s.id), label:s.label})));
      slots.forEach(s => slotsMap.set(Number(s.id), s));
      select.disabled = false;
    } else {
      select.innerHTML = "";
      const opt = document.createElement("option"); opt.value=""; opt.textContent="— нет слотов —";
      select.appendChild(opt);
      select.disabled = true;
    }
    select?.addEventListener("change", refreshOccupancy);
  }
  async function loadSlotsFromApi(){
    const r = await fetch("/api/schedule/slots", { credentials:"include" });
    if (!r.ok) return [];
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    return arr.map(s => {
      const id = Number(s.id ?? s.slotId ?? s.slot_id);
      const start = s.startAt ?? s.start_at ?? s.start;
      const end   = s.endAt   ?? s.end_at   ?? s.end;
      return { id, label:`${formatTime(start)} – ${formatTime(end)}` };
    }).filter(s => Number.isFinite(s.id));
  }
  function formatTime(isoLike){
    if (!isoLike) return "??:??";
    const d = new Date(String(isoLike).replace(" ","T"));
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  // ===== Даты =====
  function initDates(){
    const start=$("#date-input"), end=$("#date-end-input");
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const todayStr = iso(new Date());
    if (start && !start.value) start.value = todayStr;
    if (end   && !end.value)   end.value   = todayStr;
  }

  // ===== Фильтр по факультету/спецу =====
  function initFilterMenu(){
    const btn   = $("#filter-btn");
    const menu  = $("#filter-menu");
    const apply = $("#flt-apply");
    const clear = $("#flt-clear");
    const facultySel = $("#flt-faculty");
    const specSel    = $("#flt-spec");

    loadFaculties().then(list => fillSelect(facultySel, [{value:"",label:"Все факультеты"}, ...list]));
    loadSpecs().then(list => fillSelect(specSel, [{value:"",label:"Все специализации"}, ...list]));

    btn?.addEventListener("click", () => menu.classList.toggle("open"));

    apply?.addEventListener("click", () => {
      const facId  = facultySel.value.trim();
      const specId = specSel.value.trim();
      const rooms  = $all(".room");

      rooms.forEach(r => {
        if (r.classList.contains("foyer")) return;

        const name = r.dataset.room || r.textContent.trim();
        const id   = classroomIdFromRoom(name);
        const meta = RoomsMeta.byId.get(id) || RoomsMeta.byName.get(name);

        const facMatch  = !facId  || (meta?.facultyIds || []).map(String).includes(facId);
        const specMatch = !specId || (meta?.specializationIds || []).map(String).includes(specId);
        const match = facMatch && specMatch;

        r.classList.toggle("filter-hit", match);
        r.classList.toggle("dim", !match);
      });

      menu.classList.remove("open");
    });

    clear?.addEventListener("click", () => {
      facultySel.value = "";
      specSel.value    = "";
      $all(".room").forEach(r => r.classList.remove("filter-hit","dim"));
      menu.classList.remove("open");
    });

    document.addEventListener("click", (e)=>{
      if (!menu?.contains(e.target) && !btn?.contains(e.target)) menu?.classList.remove("open");
    });
  }

  async function loadFaculties(){
    try{
      const r = await fetch("/api/faculties?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      return arr.map(f => ({ value:String(f.id), label:f.name || f.title || `Факультет ${f.id}` }));
    } catch { return []; }
  }
  async function loadSpecs(){
    try{
      const r = await fetch("/api/specializations?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      return arr.map(s => ({ value:String(s.id), label:s.name || s.title || `Спец. ${s.id}` }));
    } catch { return []; }
  }

  // ===== Комнаты / клики =====
  function initRooms(){
    const rooms = $all(".room");
    rooms.forEach(btn => {
      if (btn.classList.contains("foyer")) return;
      btn.setAttribute("tabindex","0");
      btn.addEventListener("keydown", (e)=>{
        if (e.key==="Enter" || e.key===" "){ e.preventDefault(); btn.click(); }
      });
      btn.addEventListener("click", () => {
        const roomName = btn.dataset.room || btn.textContent.trim();
        const capacity = Number(btn.dataset.capacity || 0);
        const floorEl  = btn.closest(".floor");
        const floor    = Number(floorEl?.dataset.floor || 1);

        const slotSel = $("#slot-filter");
        const slot = { id:Number(slotSel?.value || 0), label:slotSel?.selectedOptions?.[0]?.textContent || "—" };

        // Обновлённый источник чётности — приоритет селекта
        const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek:"", weekParityType:"ANY" };
        const wtSel = $("#sch-weektype")?.value;
        const weekParityType = wtSel || sched.weekParityType || "ANY";

        if (!sched.dayOfWeek){
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
          weekParityType
        });
      });
    });
  }

  // === Подсветка заполняемости (по людям) ===
  async function refreshOccupancy(){
    const sched = window.SchedulePanel?.getSettings?.() || { dayOfWeek:"", weekParityType:"ANY" };
    if (!sched.dayOfWeek){
      const dateStr = $("#date-input")?.value || "";
      sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
    }
    const weekParityType = $("#sch-weektype")?.value || sched.weekParityType || "ANY";
    const slotId = Number($("#slot-filter")?.value || 0);

    // оптимизация: один агрегированный запрос на слот
    const slim = await fetchAllBookings(sched.dayOfWeek, weekParityType, slotId);

    const usedByRoom = new Map(); // classroomId -> persons
    for (const b of slim) {
      const g = GroupsCache.byId.get(Number(b.groupId));
      const add = g ? Number(g.personsCount || 0) : 0;
      const cid = Number(b.classroomId);
      usedByRoom.set(cid, (usedByRoom.get(cid) || 0) + add);
    }

    for (const btn of $all(".room")) {
      if (btn.classList.contains("foyer")) continue;
      const roomName = btn.dataset.room || btn.textContent.trim();
      const capacity = Number(btn.dataset.capacity || 0);
      const classroomId = classroomIdFromRoom(roomName);
      const used = usedByRoom.get(classroomId) || 0;
      paintRoom(btn, used, capacity);
    }
  }

  async function fetchAllBookings(dayOfWeek, weekParityType, slotId){
    const params = new URLSearchParams({
      dayOfWeek, weekParityType, slotId:String(slotId), slim:"true"
    });
    const r = await fetch(`/api/bookings/search?${params.toString()}`, { credentials:"include" });
    return r.ok ? r.json() : [];
  }

  // Легенда: пусто | ≤100% | до +25% | до +50% | > +50%
  function paintRoom(btn, usedPersons, capacity){
    btn.classList.remove("idle","ok","warn","danger","over");
    if (!capacity || usedPersons <= 0){ btn.classList.add("idle"); return; }
    const ratio = usedPersons / capacity;
    if (ratio <= 1.0){  btn.classList.add("ok");     return; }
    if (ratio <= 1.25){ btn.classList.add("warn");   return; }
    if (ratio <= 1.5){  btn.classList.add("danger"); return; }
    btn.classList.add("over");
  }

  function attachRefreshHandlers(){
    $("#date-input")   ?.addEventListener("change", refreshOccupancy);
    $("#sch-weektype") ?.addEventListener("change", refreshOccupancy);
    $("#sch-day")      ?.addEventListener("change", refreshOccupancy);
    $("#slot-filter")  ?.addEventListener("change", refreshOccupancy);
  }

  // ===== Утилиты =====
  function classroomIdFromRoom(roomName){
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);
    let hash = 1000;
    for (let i=0;i<roomName.length;i++) hash = (hash*31 + roomName.charCodeAt(i)) >>> 0;
    return hash;
  }
  function fillSelect(select, items){
    if (!select) return;
    select.innerHTML = "";
    for (const it of items){
      const opt = document.createElement("option");
      opt.value = it.value;
      opt.textContent = it.label;
      select.appendChild(opt);
    }
  }

  window.planRefreshOccupancy = refreshOccupancy;
})()

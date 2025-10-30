// plan-page.js
// Слоты/фильтры/подсветка — как было.
// Рендер схемы: из layoutJson по абсолютным координатам. Корпусы убраны.

(function () {
  "use strict";

  const $    = (sel, root) => (root || document).querySelector(sel);
  const $all = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function ready(cb){
    if(document.readyState==="loading"){
      document.addEventListener("DOMContentLoaded",cb,{once:true});
    } else {
      cb();
    }
  }

  // ===== Кэши для расписаний/метаданных =====
  const GroupsCache = window.GroupsCache || { byId:new Map(), loaded:false };
  const RoomsMeta   = window.RoomsMeta   || { byId:new Map(), byName:new Map(), loaded:false };

  async function loadGroups(){
    if (GroupsCache.loaded) return;
    try{
      const r = await fetch("/api/groups?size=1000", { credentials:"include" });
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      GroupsCache.byId = new Map(arr.map(g => [Number(g.id), {
        id:Number(g.id),
        personsCount:Number(g.personsCount||0)
      }]));
    } finally {
      GroupsCache.loaded = true;
      window.GroupsCache = GroupsCache;
    }
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
          corpus: c.corpus || c.building || "",
          facultyIds: Array.isArray(c.facultyIds) ? c.facultyIds.map(Number) : [],
          specializationIds: Array.isArray(c.specializationIds) ? c.specializationIds.map(Number) : []
        };
        if (Number.isFinite(id)) RoomsMeta.byId.set(id, meta);
        if (nm) RoomsMeta.byName.set(nm, meta);
      }
    } finally {
      RoomsMeta.loaded = true;
      window.RoomsMeta = RoomsMeta;
    }
  }

  // ===== Кэш слотов =====
  const slotsMap = new Map(); // id -> {id,label}

  // ===== STATE: только схемы (без корпусов) =====
  const LayoutState = {
    layouts: [],              // [{id,name,floorNumber,layoutJson?}]
    currentLayoutId: null,
    currentLayoutData: null   // {id,name,floorNumber,layoutJson}
  };

  // =========================
  // Основной сценарий
  // =========================
  ready(async () => {
    await initLayoutsFlow();

    window.SchedulePanel?.init?.();
    initFloorSwitch();
    await initSlots();
    initDateField();
    initTimeZones();
    initRooms(); // навесим клики, если в статике были комнаты (после render заменим ещё раз)

    await Promise.all([loadGroups(), loadRoomsMeta()]);
    initFilterMenu();

    attachRefreshHandlers();
    refreshOccupancy();
  });

  // =========================
  // Схемы
  // =========================
  async function initLayoutsFlow() {
    await loadAllLayouts();

    if (LayoutState.layouts.length > 0 && LayoutState.currentLayoutId == null) {
      LayoutState.currentLayoutId = LayoutState.layouts[0].id;
    }

    updateLayoutSelect();
    await loadCurrentLayoutFull();
    applyHeaderInfo();
    renderBuildingPlanFromLayout();
    bindLayoutChangeHandler();
  }

  async function loadAllLayouts() {
    try {
      const r = await fetch("/api/layouts", { credentials:"include" });
      if (!r.ok) { LayoutState.layouts = []; return; }
      const data = await r.json();
      LayoutState.layouts = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    } catch(e) {
      console.error("Ошибка загрузки списка схем", e);
      LayoutState.layouts = [];
    }
  }

  async function loadCurrentLayoutFull() {
    if (!LayoutState.currentLayoutId) { LayoutState.currentLayoutData = null; return; }
    try {
      const r = await fetch(`/api/layouts/${LayoutState.currentLayoutId}`, { credentials:"include" });
      if (!r.ok) { LayoutState.currentLayoutData = null; return; }
      LayoutState.currentLayoutData = await r.json();
    } catch(e) {
      console.error("Ошибка загрузки выбранной схемы", e);
      LayoutState.currentLayoutData = null;
    }
  }

  function updateLayoutSelect() {
    const sel = $("#layout-select");
    if (!sel) return;
    sel.innerHTML = "";

    if (LayoutState.layouts.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "нет схем";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }

    // пункт «Дефолтная схема» (id пустой)
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "Дефолтная схема";
    def.selected = LayoutState.currentLayoutId == null;
    sel.appendChild(def);

    LayoutState.layouts.forEach(l => {
      const opt = document.createElement("option");
      opt.value = String(l.id);
      const floorLabel = (l.floorNumber ?? null) !== null ? `этаж ${l.floorNumber} · ` : "";
      opt.textContent = l.name ? (floorLabel + l.name) : (`схема ${l.id}`);
      if (l.id === LayoutState.currentLayoutId) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.disabled = false;
  }

  function applyHeaderInfo() {
    const lNameSpan = $("#current-layout-name");
    const lObj = LayoutState.layouts.find(l => l.id === LayoutState.currentLayoutId);

    if (lNameSpan) {
      if (!LayoutState.currentLayoutId) {
        lNameSpan.textContent = "Дефолтная схема";
      } else if (lObj) {
        const floorLabel = (lObj.floorNumber ?? null) !== null ? `этаж ${lObj.floorNumber} · ` : "";
        lNameSpan.textContent = lObj.name ? (floorLabel + lObj.name) : (`схема ${lObj.id}`);
      } else {
        lNameSpan.textContent = "—";
      }
    }

    const editBtn = $("#to-editor-btn");
    if (editBtn) {
      const floorParam = lObj && lObj.floorNumber != null ? lObj.floorNumber : "";
      const layoutNameParam = lObj && lObj.name ? encodeURIComponent(lObj.name) : "";
      editBtn.href =
        "/app/layout-editor.html"
        + "?floor=" + floorParam
        + "&name=" + layoutNameParam
        + "&layoutId=" + (LayoutState.currentLayoutId || "");
    }
  }

  function bindLayoutChangeHandler() {
    const layoutSel = $("#layout-select");
    if (!layoutSel) return;
    layoutSel.addEventListener("change", async (ev) => {
      const raw = ev.target.value;
      const newId = raw === "" ? null : parseInt(raw, 10);
      LayoutState.currentLayoutId = (newId==null || Number.isNaN(newId)) ? null : newId;

      await loadCurrentLayoutFull();
      applyHeaderInfo();
      renderBuildingPlanFromLayout();
    });
  }

  // =========================
  // РЕНДЕР ПО КООРДИНАТАМ
  // =========================
  function renderBuildingPlanFromLayout() {
    const container = $("#building-plan");
    if (!container) return;

    // Если «Дефолтная схема» — оставляем статическую разметку как есть.
    if (!LayoutState.currentLayoutId) {
      return;
    }

    const data = LayoutState.currentLayoutData;
    if (!data || !data.layoutJson) return;

    let parsed;
    try {
      parsed = JSON.parse(data.layoutJson);
    } catch (e) {
      console.error("layoutJson не парсится:", e, data.layoutJson);
      return;
    }

    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
    // посчитаем bounding box
    const bbox = computeBBox(elements);
    const stagePadding = 40; // немного воздуха вокруг
    const stageW = Math.max(600, Math.ceil(bbox.maxX + stagePadding));
    const stageH = Math.max(400, Math.ceil(bbox.maxY + stagePadding));
    const floorNum = data.floorNumber ?? "—";

    // Сцена
    const stage = document.createElement("div");
    stage.className = "layout-stage";
    stage.setAttribute("aria-label", `Этаж ${floorNum}`);
    stage.style.position = "relative";
    stage.style.width = stageW + "px";
    stage.style.height = stageH + "px";
    stage.style.border = "2px solid #222";
    stage.style.borderRadius = "10px";
    stage.style.background = "#fffdf4";        // лёгкий фон, чтобы было видно
    stage.style.margin = "0 auto";
    stage.style.overflow = "hidden";

    // Заголовок внутри сцены
    const title = document.createElement("div");
    title.textContent = `Этаж ${floorNum}`;
    title.style.position = "absolute";
    title.style.left = "12px";
    title.style.top = "8px";
    title.style.fontWeight = "700";
    title.style.userSelect = "none";
    stage.appendChild(title);

    // Элементы
    for (const el of elements) {
      const node = createNodeForElement(el);
      if (node) stage.appendChild(node);
    }

    // Заменяем полностью предыдущую статичную разметку
    container.innerHTML = "";
    container.appendChild(stage);

    // после обновления DOM — вернуть клики аудиторий и подсветку
    initRooms();
    attachRefreshHandlers();
    refreshOccupancy();
  }

  function computeBBox(elements){
    let maxX = 0, maxY = 0;
    for (const el of elements){
      const w = Number(el.width || (el.type==="round" ? el.height : 0)) || 0;
      const h = Number(el.height || (el.type==="round" ? el.width : 0)) || 0;
      const x = Number(el.x || 0);
      const y = Number(el.y || 0);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    return { maxX, maxY };
  }

  function createNodeForElement(el){
    const base = document.createElement(
      el.type === "room" ? "button" : "div"
    );

    const x = Number(el.x || 0);
    const y = Number(el.y || 0);
    const w = Number(el.width || (el.type==="round" ? el.height : 0)) || 0;
    const h = el.type === "round"
      ? (Number(el.width || 0) || 0)
      : (Number(el.height || 0) || 0);

    // позиционирование
    base.style.position = "absolute";
    base.style.left = x + "px";
    base.style.top = y + "px";
    base.style.width = w + "px";
    base.style.height = h + "px";
    base.style.boxSizing = "border-box";
    base.style.display = "flex";
    base.style.alignItems = "center";
    base.style.justifyContent = "center";
    base.style.padding = "6px";
    base.style.fontSize = "13px";
    base.style.lineHeight = "1.2";
    base.style.userSelect = "none";

    // обводка/заливка
    base.style.backgroundColor = el.fill || "#fff";
    base.style.borderColor = el.stroke || "#000";
    base.style.borderStyle = el.strokeStyle || "solid";
    base.style.borderWidth = "2px";
    base.style.color = "#111";

    // форма
    if (el.type === "round") {
      base.style.borderRadius = "50%";
    } else if (el.type === "oval") {
      base.style.borderRadius = "50%";
    } else if (el.type === "semicircle") {
      base.style.borderTopLeftRadius = (h * 2) + "px";
      base.style.borderTopRightRadius = (h * 2) + "px";
      base.style.borderBottomLeftRadius = "0";
      base.style.borderBottomRightRadius = "0";
    } else {
      base.style.borderRadius = "6px";
    }

    // подпись
    let text = "";
    switch (el.type) {
      case "room": {
        const rn = el.roomName || "Ауд. ?";
        const cap = Number(el.capacity || 0);
        text = `${rn} (${cap})`;
        base.classList.add("room");
        base.dataset.room = rn;
        base.dataset.capacity = String(cap);
        base.setAttribute("type", "button");
        base.style.cursor = "pointer";
        // «кнопочный» вид без системного стиля
        base.style.backgroundClip = "padding-box";
        base.style.appearance = "none";
        base.style.webkitAppearance = "none";
        break;
      }
      case "corridor":
        text = el.labelText || "Коридор / зона";
        base.style.borderStyle = el.strokeStyle || "dashed";
        break;
      case "wall":
        text = el.labelText || "Стена";
        base.style.color = "#fff";
        break;
      case "door":
        text = el.labelText || "Вход";
        break;
      case "lift":
        text = el.labelText || "Лифт";
        break;
      case "stairs":
        text = el.labelText || "Лестница";
        break;
      case "wc":
        text = el.labelText || "WC";
        break;
      case "label":
        text = el.labelText || "Надпись";
        base.style.background = "transparent";
        break;
      case "rect":
        text = el.labelText || "Прямоугольник";
        break;
      case "oval":
        text = el.labelText || "Овал";
        break;
      case "round":
        text = el.labelText || "Зона";
        break;
      case "semicircle":
        text = el.labelText || "Полукруг";
        break;
      default:
        text = el.labelText || el.type;
    }
    base.textContent = text;

    return base;
  }

  // =========================
  // Этажи (оставляем — вдруг пригодится)
  // =========================
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

  // =========================
  // Слоты
  // =========================
  async function initSlots(){
    const select = $("#slot-filter");
    const slots  = await loadSlotsFromApi();
    if (slots.length){
      fillSelect(select, slots.map(s => ({value:String(s.id), label:s.label})));
      slots.forEach(s => slotsMap.set(Number(s.id), s));
      select.disabled = false;
    } else {
      select.innerHTML = "";
      const opt = document.createElement("option");
      opt.value="";
      opt.textContent="— нет слотов —";
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
      const id    = Number(s.id ?? s.slotId ?? s.slot_id);
      const start = s.startAt ?? s.start_at ?? s.start;
      const end   = s.endAt   ?? s.end_at   ?? s.end;
      return {
        id,
        label:`${formatTime(start)} – ${formatTime(end)}`
      };
    }).filter(s => Number.isFinite(s.id));
  }

  function formatTime(isoLike){
    if (!isoLike) return "??:??";
    const d = new Date(String(isoLike).replace(" ","T"));
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  // =========================
  // Дата
  // =========================
  function initDateField(){
    const start = document.querySelector("#date-input");
    const toISODate = d => new Date(d.getTime() - d.getTimezoneOffset()*60000)
                            .toISOString().slice(0,10);
    const todayStr = toISODate(new Date());
    if (start && !start.value) start.value = todayStr;
  }

  // =========================
  // Тайм-зоны (фиксированные UTC)
  // =========================
  function initTimeZones(){
    const sel = document.getElementById("sch-tz");
    if (!sel) return;

    const tzOptions = [
      { value:"UTC-11:00", label:"UTC−11 — Midway" },
      { value:"UTC-10:00", label:"UTC−10 — Honolulu" },
      { value:"UTC-09:00", label:"UTC−09 — Anchorage" },
      { value:"UTC-08:00", label:"UTC−08 — Los Angeles" },
      { value:"UTC-07:00", label:"UTC−07 — Denver" },
      { value:"UTC-06:00", label:"UTC−06 — Chicago" },
      { value:"UTC-05:00", label:"UTC−05 — New York" },
      { value:"UTC-04:00", label:"UTC−04 — Halifax" },
      { value:"UTC-03:00", label:"UTC−03 — São Paulo" },
      { value:"UTC-02:00", label:"UTC−02 — South Georgia" },
      { value:"UTC-01:00", label:"UTC−01 — Azores" },
      { value:"UTC+00:00", label:"UTC±00 — London" },
      { value:"UTC+01:00", label:"UTC+01 — Berlin" },
      { value:"UTC+02:00", label:"UTC+02 — Kyiv" },
      { value:"UTC+03:00", label:"UTC+03 — Москва (по умолчанию)" },
      { value:"UTC+04:00", label:"UTC+04 — Dubai" },
      { value:"UTC+05:00", label:"UTC+05 — Karachi" },
      { value:"UTC+06:00", label:"UTC+06 — Dhaka" },
      { value:"UTC+07:00", label:"UTC+07 — Bangkok" },
      { value:"UTC+08:00", label:"UTC+08 — Shanghai" },
      { value:"UTC+09:00", label:"UTC+09 — Tokyo" },
      { value:"UTC+10:00", label:"UTC+10 — Sydney" },
      { value:"UTC+11:00", label:"UTC+11 — Solomon Islands" },
      { value:"UTC+12:00", label:"UTC+12 — Auckland" }
    ];

    sel.innerHTML = "";
    for (const tz of tzOptions){
      const opt = document.createElement("option");
      opt.value = tz.value;
      opt.textContent = tz.label;
      sel.appendChild(opt);
    }

    sel.value = "UTC+03:00";
  }

  // =========================
  // Фильтры (факультет/спец)
  // =========================
  function initFilterMenu(){
    const btn   = $("#filter-btn");
    const menu  = $("#filter-menu");
    const apply = $("#flt-apply");
    const clear = $("#flt-clear");
    const facultySel = $("#flt-faculty");
    const specSel    = $("#flt-spec");

    loadFaculties().then(list => fillSelect(
      facultySel,
      [{value:"",label:"Все факультеты"}, ...list]
    ));
    loadSpecs().then(list => fillSelect(
      specSel,
      [{value:"",label:"Все специализации"}, ...list]
    ));

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
      if (!menu?.contains(e.target) && !btn?.contains(e.target)) {
        menu?.classList.remove("open");
      }
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

  // =========================
  // Комнаты / клики
  // =========================
  function initRooms(){
    const rooms = $all(".room");
    rooms.forEach(btn => {
      if (btn.classList.contains("foyer")) return;

      btn.setAttribute("tabindex","0");

      btn.addEventListener("keydown", (e)=>{
        if (e.key==="Enter" || e.key===" "){
          e.preventDefault();
          btn.click();
        }
      });

      btn.addEventListener("click", () => {
        const roomName = btn.dataset.room || btn.textContent.trim();
        const capacity = Number(btn.dataset.capacity || 0);
        const floor    = 1; // в новой сцене — одна плоскость (номер берём из заголовка при необходимости)

        const slotSel = $("#slot-filter");
        const slot = {
          id: Number(slotSel?.value || 0),
          label: slotSel?.selectedOptions?.[0]?.textContent || "—"
        };

        const sched = window.SchedulePanel?.getSettings?.() || {
          dayOfWeek:"", weekParityType:"ANY"
        };
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
          roomName,
          capacity,
          floor,
          slot,
          classroomId,
          dayOfWeek: sched.dayOfWeek,
          weekParityType
        });
      });
    });
  }

  // =========================
  // Подсветка заполняемости
  // =========================
  async function refreshOccupancy(){
    const sched = window.SchedulePanel?.getSettings?.() || {
      dayOfWeek:"", weekParityType:"ANY", myOnly:false
    };

    if (!sched.dayOfWeek){
      const dateStr = $("#date-input")?.value || "";
      sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
    }

    const weekParityType = $("#sch-weektype")?.value || sched.weekParityType || "ANY";
    const slotId = Number($("#slot-filter")?.value || 0);

    const slim = await fetchAllBookings(
      sched.dayOfWeek,
      weekParityType,
      slotId,
      !!sched.myOnly
    );

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

  async function fetchAllBookings(dayOfWeek, weekParityType, slotId, myOnly){
    const params = new URLSearchParams({
      dayOfWeek,
      weekParityType,
      slotId:String(slotId)
    });
    const baseUrl = myOnly ? "/api/bookings/my" : "/api/bookings/search";
    if (!myOnly) params.set("slim","true");
    const r = await fetch(`${baseUrl}?${params.toString()}`, { credentials:"include" });
    return r.ok ? r.json() : [];
  }

  function paintRoom(btn, usedPersons, capacity){
    btn.classList.remove("idle","ok","warn","danger","over");
    if (!capacity || usedPersons <= 0){
      btn.classList.add("idle");
      return;
    }
    const ratio = usedPersons / capacity;
    if (ratio <= 1.0){ btn.classList.add("ok"); return; }
    if (ratio <= 1.25){ btn.classList.add("warn"); return; }
    if (ratio <= 1.5){ btn.classList.add("danger"); return; }
    btn.classList.add("over");
  }

  function attachRefreshHandlers(){
    $("#date-input")   ?.addEventListener("change", refreshOccupancy);
    $("#sch-weektype") ?.addEventListener("change", refreshOccupancy);
    $("#sch-day")      ?.addEventListener("change", refreshOccupancy);
    $("#slot-filter")  ?.addEventListener("change", refreshOccupancy);
  }

  // =========================
  // Утилиты
  // =========================
  function classroomIdFromRoom(roomName){
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);
    let hash = 1000;
    for (let i=0;i<roomName.length;i++){
      hash = (hash*31 + roomName.charCodeAt(i)) >>> 0;
    }
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

})();

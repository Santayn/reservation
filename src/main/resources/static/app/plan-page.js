// plan-page.js (исправленная версия под вариант 2)
// Логика:
// 1. грузим корпуса (/api/buildings) -> building-select
// 2. при выборе корпуса грузим этажи этого корпуса (/api/layouts/by-building/{buildingId}) -> layout-select
// 3. при выборе layout грузим её JSON (/api/layouts/{layoutId}) и рисуем абсолютными координатами
// 4. запрашиваем бронирования с бэка, используя настоящий classroomDbId (id из таблицы classrooms),
//    а не "угаданное" число из текста аудитории
// 5. при сохранении брони потом будем слать classroomName, а не classroomId

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

  // удобный хелпер: получить настоящий PK аудитории по её имени с плана
  function getRealClassroomIdByName(roomName) {
    if (!roomName) return null;
    const meta = RoomsMeta.byName.get(roomName.trim());
    return meta ? Number(meta.id) : null;
  }

  // ===== Кэш слотов =====
  const slotsMap = new Map(); // id -> {id,label}

  // ===== STATE =====
  // buildings: [{id,name}]
  // layoutsByBuilding[buildingId] = [{id,name,floorNumber,layoutJson?}, ...]
  // currentBuildingId
  // currentLayoutId
  // currentLayoutData
  const LayoutState = {
    buildings: [],
    layoutsByBuilding: new Map(),
    currentBuildingId: null,
    currentLayoutId: null,
    currentLayoutData: null
  };

  // =========================
  // Основной сценарий
  // =========================
  ready(async () => {
    await initBuildingsAndLayoutsFlow();

    window.SchedulePanel?.init?.();
    await initSlots();
    initDateField();
    initTimeZones();
    await Promise.all([loadGroups(), loadRoomsMeta()]);
    initFilterMenu();

    attachRefreshHandlers();
    refreshOccupancy();
  });

  // =========================
  // Buildings + Layouts flow
  // =========================

  async function initBuildingsAndLayoutsFlow() {
    // 1. загрузить корпуса
    await loadBuildings();
    fillBuildingSelect();

    // 2. обработчик смены корпуса
    bindBuildingChangeHandler();

    // выбрать первый корпус автоматически (если есть)
    if (LayoutState.buildings.length > 0) {
      LayoutState.currentBuildingId = LayoutState.buildings[0].id;
      $("#building-select").value = String(LayoutState.currentBuildingId);
      await loadLayoutsForBuilding(LayoutState.currentBuildingId);
      fillLayoutSelect();
    } else {
      // корпусов нет -> нет этажей
      clearLayoutSelect("— нет этажей —");
    }

    // 3. обработчик смены схемы этажа
    bindLayoutChangeHandler();

    // 4. выбрать первый этаж автоматически (если есть)
    const curList = LayoutState.layoutsByBuilding.get(LayoutState.currentBuildingId) || [];
    if (curList.length > 0) {
        LayoutState.currentLayoutId = curList[0].id;
        $("#layout-select").value = String(LayoutState.currentLayoutId);
        await loadCurrentLayoutFull();
        applyHeaderInfo();
        renderBuildingPlanFromLayout();
    } else {
        LayoutState.currentLayoutId = null;
        LayoutState.currentLayoutData = null;
        applyHeaderInfo();
        renderBuildingPlanFromLayout(); // будет пусто
    }
  }

  async function loadBuildings() {
    // GET /api/buildings -> [{id,name}, ...]
    try {
      const r = await fetch("/api/buildings", { credentials:"include" });
      if (!r.ok) { LayoutState.buildings = []; return; }
      const data = await r.json();
      LayoutState.buildings = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Ошибка загрузки корпусов", e);
      LayoutState.buildings = [];
    }
  }

  function fillBuildingSelect() {
    const sel = $("#building-select");
    if (!sel) return;
    sel.innerHTML = "";

    // плейсхолдер
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "— выберите здание —";
    sel.appendChild(ph);

    LayoutState.buildings.forEach(b => {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name || ("Корпус " + b.id);
      sel.appendChild(opt);
    });

    sel.disabled = LayoutState.buildings.length === 0;
  }

  function bindBuildingChangeHandler() {
    const sel = $("#building-select");
    if (!sel) return;
    sel.addEventListener("change", async (ev) => {
      const raw = ev.target.value;
      const bId = raw === "" ? null : parseInt(raw,10);

      LayoutState.currentBuildingId = (bId==null || Number.isNaN(bId)) ? null : bId;

      if (LayoutState.currentBuildingId == null) {
        // сбрасываем этажи и план
        clearLayoutSelect("— выберите корпус —");
        LayoutState.currentLayoutId = null;
        LayoutState.currentLayoutData = null;
        applyHeaderInfo();
        renderBuildingPlanFromLayout();
        refreshOccupancy(); // пересчёт, будет пусто
        return;
      }

      // загрузить этажи для выбранного корпуса
      await loadLayoutsForBuilding(LayoutState.currentBuildingId);
      fillLayoutSelect();

      // выбрать первый этаж автоматически
      const list = LayoutState.layoutsByBuilding.get(LayoutState.currentBuildingId) || [];
      if (list.length > 0) {
        LayoutState.currentLayoutId = list[0].id;
        $("#layout-select").value = String(LayoutState.currentLayoutId);
        await loadCurrentLayoutFull();
      } else {
        LayoutState.currentLayoutId = null;
        LayoutState.currentLayoutData = null;
      }

      applyHeaderInfo();
      renderBuildingPlanFromLayout();
      refreshOccupancy();
    });
  }

  async function loadLayoutsForBuilding(buildingId) {
    if (!Number.isFinite(buildingId)) {
      LayoutState.layoutsByBuilding.set(buildingId, []);
      return;
    }
    try {
      // GET /api/layouts/by-building/{buildingId}
      const r = await fetch(`/api/layouts/by-building/${buildingId}`, { credentials:"include" });
      if (!r.ok) {
        LayoutState.layoutsByBuilding.set(buildingId, []);
        return;
      }
      const data = await r.json();
      const list = Array.isArray(data) ? data : [];
      LayoutState.layoutsByBuilding.set(buildingId, list);
    } catch (e) {
      console.error("Ошибка загрузки этажей корпуса", e);
      LayoutState.layoutsByBuilding.set(buildingId, []);
    }
  }

  function clearLayoutSelect(placeholderText) {
    const sel = $("#layout-select");
    if (!sel) return;
    sel.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholderText || "— нет этажей —";
    sel.appendChild(opt);
    sel.disabled = true;
  }

  function fillLayoutSelect() {
    const sel = $("#layout-select");
    if (!sel) return;

    const bId = LayoutState.currentBuildingId;
    const list = LayoutState.layoutsByBuilding.get(bId) || [];

    sel.innerHTML = "";

    if (list.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— нет этажей —";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }

    list.forEach(l => {
      const opt = document.createElement("option");
      opt.value = String(l.id);

      // подпись в выпадающем списке
      // пример: "этаж 2 — Левое крыло"
      const floorPart = (l.floorNumber != null) ? `этаж ${l.floorNumber}` : "этаж ?";
      const namePart  = l.name ? ` — ${l.name}` : "";
      opt.textContent = floorPart + namePart;

      sel.appendChild(opt);
    });

    sel.disabled = false;
  }

  function bindLayoutChangeHandler() {
    const sel = $("#layout-select");
    if (!sel) return;
    sel.addEventListener("change", async (ev) => {
      const raw = ev.target.value;
      const newId = raw === "" ? null : parseInt(raw,10);
      LayoutState.currentLayoutId = (newId==null || Number.isNaN(newId)) ? null : newId;

      await loadCurrentLayoutFull();
      applyHeaderInfo();
      renderBuildingPlanFromLayout();
      refreshOccupancy();
    });
  }

  async function loadCurrentLayoutFull() {
    const layoutId = LayoutState.currentLayoutId;
    if (!layoutId) {
      LayoutState.currentLayoutData = null;
      return;
    }
    try {
      const r = await fetch(`/api/layouts/${layoutId}`, { credentials:"include" });
      if (!r.ok) {
        LayoutState.currentLayoutData = null;
        return;
      }
      LayoutState.currentLayoutData = await r.json();
    } catch(e) {
      console.error("Ошибка загрузки выбранной схемы", e);
      LayoutState.currentLayoutData = null;
    }
  }

  function applyHeaderInfo() {
    const lNameSpan = $("#current-layout-name");
    const layoutData = LayoutState.currentLayoutData;

    if (lNameSpan) {
      if (!layoutData) {
        lNameSpan.textContent = "—";
      } else {
        const floorPart = (layoutData.floorNumber != null)
            ? `этаж ${layoutData.floorNumber} · `
            : "";
        lNameSpan.textContent = layoutData.name
            ? (floorPart + layoutData.name)
            : (`схема ${layoutData.id}`);
      }
    }

    // формируем ссылку "Конструктор плана"
    const editBtn = $("#to-editor-btn");
    if (editBtn) {
      const floorParam = layoutData && layoutData.floorNumber != null
            ? layoutData.floorNumber
            : "";
      const layoutNameParam = layoutData && layoutData.name
            ? encodeURIComponent(layoutData.name)
            : "";
      editBtn.href =
        "/app/layout-editor.html"
        + "?floor=" + floorParam
        + "&name=" + layoutNameParam
        + "&layoutId=" + (layoutData ? layoutData.id : "");
    }
  }

  // =========================
  // РЕНДЕР ПО КООРДИНАТАМ
  // =========================
  function renderBuildingPlanFromLayout() {
    const container = $("#building-plan");
    if (!container) return;

    const data = LayoutState.currentLayoutData;
    if (!data || !data.layoutJson) {
      container.innerHTML = "";
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(data.layoutJson);
    } catch (e) {
      console.error("layoutJson не парсится:", e, data.layoutJson);
      container.innerHTML = "";
      return;
    }

    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];

    // bounding box
    const bbox = computeBBox(elements);
    const stagePadding = 40;
    const stageW = Math.max(600, Math.ceil(bbox.maxX + stagePadding));
    const stageH = Math.max(400, Math.ceil(bbox.maxY + stagePadding));
    const floorNum = data.floorNumber ?? "—";

    // сцена
    const stage = document.createElement("div");
    stage.className = "layout-stage";
    stage.setAttribute("aria-label", `Этаж ${floorNum}`);
    stage.style.position = "relative";
    stage.style.width = stageW + "px";
    stage.style.height = stageH + "px";
    stage.style.border = "1px solid #b9c8c3";
    stage.style.borderRadius = "8px";
    stage.style.background = "#f8fbfa";
    stage.style.margin = "0 auto";
    stage.style.overflow = "hidden";

    // заголовок этажа прямо на плане
    const title = document.createElement("div");
    title.textContent = `Этаж ${floorNum}`;
    title.style.position = "absolute";
    title.style.left = "12px";
    title.style.top = "8px";
    title.style.fontWeight = "700";
    title.style.userSelect = "none";
    stage.appendChild(title);

    // элементы схемы (комнаты/стены/и т.д.)
    for (const el of elements) {
      const node = createNodeForElement(el);
      if (node) stage.appendChild(node);
    }

    container.innerHTML = "";
    container.appendChild(stage);

    // после перерисовки навешиваем клики и обновляем легенду занятости
    initRooms();
    attachRefreshHandlers();
    refreshOccupancy();
  }

  function computeBBox(elements){
    let maxX = 0, maxY = 0;
    for (const el of elements){
      const w = Number(el.width || (el.type==="round" ? el.height : 0)) || 0;
      const h = el.type === "round"
        ? (Number(el.width || 0) || 0)
        : (Number(el.height || 0) || 0);
      const x = Number(el.x || 0);
      const y = Number(el.y || 0);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    return { maxX, maxY };
  }

  // ВАЖНО: аудитории больше не получают инлайновые цвета.
  // Их фон и рамка теперь управляются ТОЛЬКО классами (.room, .room.ok, .room.warn и т.д.).
  // Остальные элементы (коридоры, стены и т.п.) оставляем как раньше.
  function createNodeForElement(el){
    // Если это аудитория (кабинет)
    if (el.type === "room") {
      const base = document.createElement("button");

      const x = Number(el.x || 0);
      const y = Number(el.y || 0);
      const w = Number(el.width || 0) || 0;
      const h = Number(el.height || 0) || 0;

      // позиционирование
      base.style.position = "absolute";
      base.style.left = x + "px";
      base.style.top = y + "px";
      base.style.width = w + "px";
      base.style.height = h + "px";

      // НЕ ставим backgroundColor / borderColor / borderWidth инлайном!
      // Эти вещи задаёт CSS (.room, .room.ok, .room.warn, ...)
      base.style.boxSizing = "border-box";
      base.style.display = "flex";
      base.style.alignItems = "center";
      base.style.justifyContent = "center";
      base.style.padding = "6px";
      base.style.fontSize = "13px";
      base.style.lineHeight = "1.2";
      base.style.userSelect = "none";
      // скругление и т.д. тоже уже есть в CSS .room, так что не задаём инлайном

      base.setAttribute("type", "button");
      base.style.cursor = "pointer";
      base.style.backgroundClip = "padding-box";
      base.style.appearance = "none";
      base.style.webkitAppearance = "none";

      const rn  = el.roomName || "Ауд. ?";
      const cap = Number(el.capacity || 0);
      base.textContent = `${rn} (${cap})`;

      base.classList.add("room");
      base.dataset.room = rn;
      base.dataset.capacity = String(cap);

      return base;
    }

    // Любой другой элемент схемы (коридор, стенка и т.п.)
    const base = document.createElement("div");

    const x = Number(el.x || 0);
    const y = Number(el.y || 0);

    const w = Number(el.width || (el.type==="round" ? el.height : 0)) || 0;
    const h = el.type === "round"
      ? (Number(el.width || 0) || 0)
      : (Number(el.height || 0) || 0);

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

    // Для НЕ-аудиторий оставляем inline-цвета из layoutJson,
    // это не мешает раскраске аудиторий.
    base.style.backgroundColor = el.fill || "#fff";
    base.style.borderColor = el.stroke || "#000";
    base.style.borderStyle = el.strokeStyle || "solid";
    base.style.borderWidth = "2px";
    base.style.color = "#111";
    base.style.borderRadius = "6px";

    if (el.type === "round" || el.type === "oval") {
      base.style.borderRadius = "50%";
    } else if (el.type === "semicircle") {
      base.style.borderTopLeftRadius = (h * 2) + "px";
      base.style.borderTopRightRadius = (h * 2) + "px";
      base.style.borderBottomLeftRadius = "0";
      base.style.borderBottomRightRadius = "0";
    }

    // подпись
    let text = "";
    switch (el.type) {
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
  // Тайм-зоны
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
  // Фильтр (факультет/специализация)
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
      applyRoomMetadataFilter();
      refreshOccupancy();
      menu.classList.remove("open");
    });

    clear?.addEventListener("click", () => {
      facultySel.value = "";
      specSel.value    = "";
      applyRoomMetadataFilter();
      refreshOccupancy();
      menu.classList.remove("open");
    });

    document.addEventListener("click", (e)=>{
      if (!menu?.contains(e.target) && !btn?.contains(e.target)) {
        menu?.classList.remove("open");
      }
    });
  }

  function getRoomFilterValues() {
    return {
      facultyId: $("#flt-faculty")?.value?.trim() || "",
      specializationId: $("#flt-spec")?.value?.trim() || ""
    };
  }

  function roomMatchesMetadataFilter(roomName) {
    const { facultyId, specializationId } = getRoomFilterValues();
    if (!facultyId && !specializationId) return true;

    const meta = RoomsMeta.byName.get((roomName || "").trim());
    const facMatch = !facultyId || (meta?.facultyIds || []).map(String).includes(facultyId);
    const specMatch = !specializationId || (meta?.specializationIds || []).map(String).includes(specializationId);
    return facMatch && specMatch;
  }

  function applyRoomMetadataFilter() {
    const { facultyId, specializationId } = getRoomFilterValues();
    const filterActive = !!facultyId || !!specializationId;

    $all(".room").forEach(r => {
      const name = r.dataset.room || r.textContent.trim();
      const match = roomMatchesMetadataFilter(name);
      r.classList.toggle("filter-hit", filterActive && match);
      r.classList.toggle("dim", filterActive && !match);
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
  // Клики по комнатам
  // =========================
  function initRooms(){
    const rooms = $all(".room");
    rooms.forEach(btn => {
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

        const slotSel = $("#slot-filter");
        const slot = {
          id: Number(slotSel?.value || 0),
          label: slotSel?.selectedOptions?.[0]?.textContent || "—"
        };

        // настройки расписания
        const sched = window.SchedulePanel?.getSettings?.() || {
          dayOfWeek:"", weekParityType:"ANY"
        };
        const weekParityType = sched.weekParityType || "ANY";

        if (!sched.dayOfWeek){
          const dateStr = $("#date-input")?.value || "";
          sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
        }

        // реальный PK из БД
        const classroomDbId = getRealClassroomIdByName(roomName);

        // снять прошлую .selected
        $all(".room").forEach(r => r.classList.remove("selected"));
        btn.classList.add("selected");

        window.RoomDrawer.open({
          roomName,
          capacity,
          floor: LayoutState.currentLayoutData?.floorNumber ?? null,
          slot,
          classroomDbId,
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
    // настройки расписания (день недели, моя ли только нагрузка и т.п.)
    const sched = window.SchedulePanel?.getSettings?.() || {
      dayOfWeek:"", weekParityType:"ANY", myOnly:false
    };

    if (!sched.dayOfWeek){
      const dateStr = $("#date-input")?.value || "";
      sched.dayOfWeek = window.SchedulePanel.dayOfWeekFromDateStr(dateStr);
    }

    const dayOfWeek      = sched.dayOfWeek;
    const weekParityType = sched.weekParityType || "ANY";
    const slotId         = Number($("#slot-filter")?.value || 0);
    const myOnly         = !!sched.myOnly;
    const dateStr        = $("#date-input")?.value || "";

    const rooms = $all(".room");
    applyRoomMetadataFilter();

    if (!slotId || !dayOfWeek || !dateStr) {
      rooms.forEach(btn => {
        const capacity = Number(btn.dataset.capacity || 0);
        paintRoom(btn, 0, capacity);
      });
      return;
    }

    const usageByRoomId = await fetchUsageForRooms({
      date: dateStr,
      dayOfWeek,
      weekParityType,
      slotId,
      myOnly
    });

    for (const btn of rooms) {
      const roomName      = btn.dataset.room || btn.textContent.trim();
      const capacity      = Number(btn.dataset.capacity || 0);
      const classroomDbId = getRealClassroomIdByName(roomName);

      if (!classroomDbId || !roomMatchesMetadataFilter(roomName)) {
        paintRoom(btn, 0, capacity);
        continue;
      }

      const usedPersons = usageByRoomId.get(classroomDbId) || 0;
      paintRoom(btn, usedPersons, capacity);
    }
  }

  async function fetchUsageForRooms({ date, dayOfWeek, weekParityType, slotId, myOnly }){
    const { facultyId, specializationId } = getRoomFilterValues();
    const params = new URLSearchParams({
      date,
      dayOfWeek,
      weekParityType,
      slotId: String(slotId),
      myOnly: String(!!myOnly)
    });

    if (facultyId) {
      params.set("facultyId", facultyId);
    }
    if (specializationId) {
      params.set("specializationId", specializationId);
    }

    const r = await fetch(`/api/utilization/rooms?${params.toString()}`, { credentials:"include" });
    if (!r.ok) return new Map();

    const list = await r.json();
    const usageByRoomId = new Map();
    for (const row of Array.isArray(list) ? list : []){
      const roomId = Number(row.classroomId);
      if (Number.isFinite(roomId)) {
        usageByRoomId.set(roomId, Number(row.load || 0));
      }
    }
    return usageByRoomId;
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
    $("#date-input")      ?.addEventListener("change", refreshOccupancy);
    $("#sch-weektype")    ?.addEventListener("change", refreshOccupancy);
    $("#sch-day")         ?.addEventListener("change", refreshOccupancy);
    $("#sch-mode-weekly") ?.addEventListener("change", refreshOccupancy);
    $("#sch-mode-parity") ?.addEventListener("change", refreshOccupancy);
    $("#slot-filter")     ?.addEventListener("change", refreshOccupancy);
    $("#building-select") ?.addEventListener("change", refreshOccupancy);
    $("#layout-select")   ?.addEventListener("change", refreshOccupancy);

    window.planRefreshOccupancy = refreshOccupancy;
  }

  // =========================
  // Утилиты
  // =========================

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

  function highlightRoomExternal(roomName){
    const norm = String(roomName || "").trim();
    let targetBtn = null;
    for (const btn of $all(".room")){
      const nm = btn.dataset.room || btn.textContent.trim();
      if (nm === norm){
        targetBtn = btn;
        break;
      }
    }
    if (!targetBtn) return;

    $all(".room").forEach(r => r.classList.remove("selected"));
    targetBtn.classList.add("selected");

    targetBtn.scrollIntoView({behavior:"smooth", block:"center", inline:"center"});
  }

  window.planHighlightRoom = highlightRoomExternal;

})();

// plan-page.js
// Подсветка заполняемости аудиторий + фильтры по факультету/спецу (метаданные из БД).
// Также заполняем селект тайм-зоны фиксированными смещениями UTC-11..UTC+12,
// передаём на бэк именно строку формата "UTC+03:00", "UTC-10:00", без DST.
// ДОПОЛНЕНО: выбор корпуса и схемы из конструктора планов, динамическая отрисовка плана.

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

  // ====== STATE для корпусов и схем (новое) ======
  const LayoutState = {
    buildings: [],          // [{id, name}, ...]
    layouts: [],            // [{id,name,floorNumber,...}] для выбранного корпуса
    currentBuildingId: null,
    currentLayoutId: null,
    currentLayoutData: null // {id,name,buildingId,floorNumber,layoutJson}
  };

  // =========================
  // Основной ready() сценарий
  // =========================
  ready(async () => {
    // 0. Инициализируем выбор корпуса/схемы
    await initBuildingAndLayoutsFlow();

    // 1. Панель расписания преподавателя (если есть)
    window.SchedulePanel?.init?.();

    // 2. Переключалки этажей
    initFloorSwitch();

    // 3. Заполнить список слотов
    await initSlots();

    // 4. Дата сегодня
    initDateField();

    // 5. Тайм-зоны
    initTimeZones();

    // 6. Навесить поведение комнат (клик -> бронирование)
    initRooms();

    // 7. Подтянуть группы и мету аудиторий (для фильтра и подсветки)
    await Promise.all([loadGroups(), loadRoomsMeta()]);

    // 8. Фильтр по факультету/спецу
    initFilterMenu();

    // 9. Обновляем цвета аудиторий по заполненности
    attachRefreshHandlers();
    refreshOccupancy();
  });

  // =========================
  // INIT корпуса/схемы
  // =========================
  async function initBuildingAndLayoutsFlow() {
    // 1. грузим корпуса
    await loadBuildings();

    // если есть корпуса, по умолчанию берём первый
    if (LayoutState.buildings.length > 0 && LayoutState.currentBuildingId == null) {
      LayoutState.currentBuildingId = LayoutState.buildings[0].id;
    }

    // отрисовываем селект корпуса
    updateBuildingSelect();

    // 2. грузим схемы для выбранного корпуса
    await loadLayoutsForCurrentBuilding();

    // если есть схемы — выбираем первую по умолчанию
    if (LayoutState.layouts.length > 0 && LayoutState.currentLayoutId == null) {
      LayoutState.currentLayoutId = LayoutState.layouts[0].id;
    }

    // отрисовываем селект схем
    updateLayoutSelect();

    // 3. загружаем полную схему текущей layout
    await loadCurrentLayoutFull();

    // 4. применяем название корпуса/схемы в шапку и обновляем ссылку "Конструктор плана"
    applyHeaderInfo();

    // 5. рендерим сам план по layoutJson
    renderBuildingPlanFromLayout();

    // 6. добавляем обработчики на селекты корпуса/схемы
    bindBuildingAndLayoutHandlers();
  }

  // =========================
  // API: корпуса / схемы
  // =========================

  async function loadBuildings() {
    try {
      const r = await fetch("/api/buildings", { credentials:"include" });
      if (!r.ok) {
        LayoutState.buildings = [];
        return;
      }
      const data = await r.json();
      LayoutState.buildings = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    } catch(e) {
      console.error("Ошибка загрузки корпусов", e);
      LayoutState.buildings = [];
    }
  }

  async function loadLayoutsForCurrentBuilding() {
    if (!LayoutState.currentBuildingId) {
      LayoutState.layouts = [];
      return;
    }
    try {
      const r = await fetch(`/api/layouts/by-building/${LayoutState.currentBuildingId}`, { credentials:"include" });
      if (!r.ok) {
        LayoutState.layouts = [];
        return;
      }
      const data = await r.json();
      LayoutState.layouts = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    } catch(e) {
      console.error("Ошибка загрузки схем для корпуса", e);
      LayoutState.layouts = [];
    }
  }

  async function loadCurrentLayoutFull() {
    if (!LayoutState.currentLayoutId) {
      LayoutState.currentLayoutData = null;
      return;
    }
    try {
      const r = await fetch(`/api/layouts/${LayoutState.currentLayoutId}`, { credentials:"include" });
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

  // =========================
  // UI: селект корпуса / селект схем
  // =========================

  function updateBuildingSelect() {
    const sel = $("#building-select");
    if (!sel) return;

    sel.innerHTML = "";

    if (LayoutState.buildings.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "нет корпусов";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }

    LayoutState.buildings.forEach(b => {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name || ("Корпус #" + b.id);
      if (b.id === LayoutState.currentBuildingId) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    sel.disabled = false;
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

    LayoutState.layouts.forEach(l => {
      const opt = document.createElement("option");
      opt.value = String(l.id);

      const floorLabel = (l.floorNumber !== undefined && l.floorNumber !== null)
        ? "этаж " + l.floorNumber + " · "
        : "";

      opt.textContent = l.name
        ? (floorLabel + l.name)
        : ("схема #" + l.id);

      if (l.id === LayoutState.currentLayoutId) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    sel.disabled = false;
  }

  // =========================
  // UI: заголовок и кнопка "Конструктор плана"
  // =========================

  function applyHeaderInfo() {
    const bNameSpan = $("#current-building-name");
    const lNameSpan = $("#current-layout-name");

    const bObj = LayoutState.buildings.find(b => b.id === LayoutState.currentBuildingId);
    const lObj = LayoutState.layouts.find(l => l.id === LayoutState.currentLayoutId);

    if (bNameSpan) {
      bNameSpan.textContent = bObj ? (bObj.name || ("Корпус #" + bObj.id)) : "—";
    }

    if (lNameSpan) {
      if (lObj) {
        const floorLabel = (lObj.floorNumber !== undefined && lObj.floorNumber !== null)
          ? "этаж " + lObj.floorNumber + " · "
          : "";
        lNameSpan.textContent = lObj.name
          ? (floorLabel + lObj.name)
          : ("схема #" + lObj.id);
      } else {
        lNameSpan.textContent = "—";
      }
    }

    // Кнопка "Конструктор плана": подставим параметры
    const editBtn = $("#to-editor-btn");
    if (editBtn) {
      const floorParam = lObj && lObj.floorNumber != null ? lObj.floorNumber : "";
      const layoutNameParam = lObj && lObj.name ? encodeURIComponent(lObj.name) : "";
      editBtn.href =
        "/app/layout-editor.html"
        + "?buildingId=" + (LayoutState.currentBuildingId || "")
        + "&floor=" + floorParam
        + "&name=" + layoutNameParam;
    }
  }

  // =========================
  // Рендер плана из layoutJson
  // =========================
  // Сейчас делаем простой вывод списка аудиторий из elements[type="room"].
  // Когда захочешь — усложним (коридоры, абсолютные позиции и т.д.).
  function renderBuildingPlanFromLayout() {
    const container = $("#building-plan");
    if (!container) return;

    // если схемы нет или нет layoutJson — не трогаем твою статическую вёрстку
    if (!LayoutState.currentLayoutData || !LayoutState.currentLayoutData.layoutJson) {
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(LayoutState.currentLayoutData.layoutJson);
    } catch (e) {
      console.error("layoutJson не парсится:", e, LayoutState.currentLayoutData.layoutJson);
      return;
    }

    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
    const roomsOnly = elements.filter(el => el.type === "room");

    // В эту схему обычно весь этаж один, floorNumber у схемы
    const floorNum = LayoutState.currentLayoutData.floorNumber ?? "—";

    // Генерим простой layout: секция с одним этажом и списком аудиторий
    const htmlParts = [];
    htmlParts.push(
      '<div class="wings">'
      + '<section class="wing" aria-label="Этаж ' + escapeHtml(floorNum) + '">'
      + '<h3>Этаж ' + escapeHtml(floorNum) + '</h3>'
      + '<div class="floor active" data-floor="' + escapeHtml(floorNum) + '">'
      + '<div class="rooms">'
    );

    roomsOnly.forEach(r => {
      const rn = r.roomName || "Ауд. ?";
      const cap = Number(r.capacity || 0);
      htmlParts.push(
        '<button type="button" class="room"'
        + ' data-room="' + escapeHtml(rn) + '"'
        + ' data-capacity="' + cap + '">'
        + escapeHtml(rn) + ' (' + cap + ')'
        + '</button>'
      );
    });

    htmlParts.push(
      '</div>'   // .rooms
      + '</div>' // .floor
      + '</section>'
      + '</div>' // .wings
    );

    container.innerHTML = htmlParts.join("");

    // после обновления DOM нам нужно реинициализировать интерактив
    initFloorSwitch();
    initRooms();
    attachRefreshHandlers();
    refreshOccupancy();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================
  // Обработчики селектов корпуса/схемы
  // =========================
  function bindBuildingAndLayoutHandlers() {
    const buildingSel = $("#building-select");
    const layoutSel   = $("#layout-select");

    if (buildingSel) {
      buildingSel.addEventListener("change", async (ev) => {
        const newId = parseInt(ev.target.value, 10);
        if (!Number.isNaN(newId)) {
          LayoutState.currentBuildingId = newId;
        } else {
          LayoutState.currentBuildingId = null;
        }

        // заново грузим схемы для корпуса
        await loadLayoutsForCurrentBuilding();

        // сбрасываем выбранную схему
        LayoutState.currentLayoutId =
          LayoutState.layouts.length > 0 ? LayoutState.layouts[0].id : null;

        updateLayoutSelect();

        // грузим полную выбранную схему
        await loadCurrentLayoutFull();

        // обновляем заголовок, план и всё остальное
        applyHeaderInfo();
        renderBuildingPlanFromLayout();
      });
    }

    if (layoutSel) {
      layoutSel.addEventListener("change", async (ev) => {
        const newLayoutId = parseInt(ev.target.value, 10);
        if (!Number.isNaN(newLayoutId)) {
          LayoutState.currentLayoutId = newLayoutId;
        } else {
          LayoutState.currentLayoutId = null;
        }

        await loadCurrentLayoutFull();
        applyHeaderInfo();
        renderBuildingPlanFromLayout();
      });
    }
  }

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

  // ===== Дата (одно поле) =====
  function initDateField(){
    const start = document.querySelector("#date-input");
    const toISODate = d => new Date(d.getTime() - d.getTimezoneOffset()*60000)
                            .toISOString().slice(0,10);
    const todayStr = toISODate(new Date());
    if (start && !start.value) start.value = todayStr;
  }

  // ===== Тайм-зоны (фиксированные UTC-офсеты без DST) =====
  // Значения option.value мы сразу делаем в формате "UTC+03:00", "UTC-10:00" и т.д.
  // Это то, что бэк ждёт в BookingCreateRequest.timeZoneId.
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

    // дефолт — Москва (UTC+03:00)
    sel.value = "UTC+03:00";
  }

  // ===== Фильтр по факультету/спецу =====
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
      return arr.map(f => ({
        value:String(f.id),
        label:f.name || f.title || `Факультет ${f.id}`
      }));
    } catch {
      return [];
    }
  }

  async function loadSpecs(){
    try{
      const r = await fetch("/api/specializations?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      return arr.map(s => ({
        value:String(s.id),
        label:s.name || s.title || `Спец. ${s.id}`
      }));
    } catch {
      return [];
    }
  }

  // ===== Комнаты / клики =====
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
        const floorEl  = btn.closest(".floor");
        const floor    = Number(floorEl?.dataset.floor || 1);

        const slotSel = $("#slot-filter");
        const slot = {
          id: Number(slotSel?.value || 0),
          label: slotSel?.selectedOptions?.[0]?.textContent || "—"
        };

        // Чётность недели
        const sched = window.SchedulePanel?.getSettings?.() || {
          dayOfWeek:"", weekParityType:"ANY"
        };
        const wtSel = $("#sch-weektype")?.value;
        const weekParityType = wtSel || sched.weekParityType || "ANY";

        // dayOfWeek
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

  // === Подсветка заполняемости (по людям) ===
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

    // один агрегированный запрос на слот
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

  // Легенда: пусто | ≤100% | до +25% | до +50% | > +50%
  function paintRoom(btn, usedPersons, capacity){
    btn.classList.remove("idle","ok","warn","danger","over");
    if (!capacity || usedPersons <= 0){
      btn.classList.add("idle");
      return;
    }
    const ratio = usedPersons / capacity;
    if (ratio <= 1.0){
      btn.classList.add("ok");
      return;
    }
    if (ratio <= 1.25){
      btn.classList.add("warn");
      return;
    }
    if (ratio <= 1.5){
      btn.classList.add("danger");
      return;
    }
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

  // экспорт для других модулей
  window.planRefreshOccupancy = refreshOccupancy;

})();

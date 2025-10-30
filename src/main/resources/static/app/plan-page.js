// plan-page.js
// Подсветка заполняемости аудиторий + фильтры по факультету/спецу.
// Тайм-зоны как фиксированные UTC±hh:mm без DST.
// Схемы здания: без корпусов. Есть только layout-select с пунктом "Дефолтная схема"
//   + остальные схемы из бэка (/api/layouts).
// Если выбрана "Дефолтная схема", верстка (#building-plan) остаётся как в HTML.
// Если выбрана любая другая схема, мы подменяем #building-plan на основе layoutJson.

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

  // =========================
  // Глобальные кэши (для других модулей)
  // =========================
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
          corpus: c.corpus || c.building || "", // это поле уже не используется визуально, но оставим для фильтра
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

  // =========================
  // Слоты расписания (пары / окна)
  // =========================
  const slotsMap = new Map(); // slotId -> {id,label}

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
  // Тайм-зоны (фиксированные UTC ±hh:mm, без DST)
  // Значения option.value -> BookingCreateRequest.timeZoneId.
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

    sel.value = "UTC+03:00"; // дефолт — Москва
  }

  // =========================
  // STATE для схем
  // =========================
  const LayoutState = {
    layouts: [],            // [{id,name,floorNumber,layoutJson?}, ...] (без корпуса)
    currentLayoutId: "default", // строка: "default" или число/id в строковом виде
    currentLayoutData: null // полная схема (если не дефолт)
  };

  // =========================
  // Инициализация схем
  // =========================
  async function initLayoutsFlow() {
    // 1. забираем все схемы
    await loadAllLayouts(); // -> заполняет LayoutState.layouts

    // 2. если есть схемы и мы ещё не выбрали конкретную,
    //    то currentLayoutId остаётся "default"
    //    (то есть мы начинаем с дефолтной статики из HTML).
    //    ничего менять не надо.

    // 3. отрисовать селект схем (добавит "Дефолтная схема" первой)
    updateLayoutSelect();

    // 4. загрузить полную выбранную схему,
    //    НО только если это не дефолт.
    await loadCurrentLayoutFull();

    // 5. проставить заголовок и ссылку в конструктор
    applyHeaderInfo();

    // 6. отрисовать план, если выбрана не дефолтная
    renderBuildingPlanFromLayout();

    // 7. подписаться на изменения селекта
    bindLayoutChangeHandler();
  }

  // GET /api/layouts -> вернёт список всех BuildingLayoutResponse
  async function loadAllLayouts() {
    try {
      const r = await fetch("/api/layouts", { credentials:"include" });
      if (!r.ok) {
        LayoutState.layouts = [];
        return;
      }
      const data = await r.json();
      LayoutState.layouts = Array.isArray(data)
        ? data
        : (Array.isArray(data.content) ? data.content : []);
    } catch(e) {
      console.error("Ошибка загрузки списка схем", e);
      LayoutState.layouts = [];
    }
  }

  // GET /api/layouts/{layoutId} -> BuildingLayoutResponse
  async function loadCurrentLayoutFull() {
    // если сейчас "default", мы ничего не грузим.
    if (LayoutState.currentLayoutId === "default") {
      LayoutState.currentLayoutData = null;
      return;
    }

    const idNum = Number(LayoutState.currentLayoutId);
    if (!Number.isFinite(idNum)) {
      LayoutState.currentLayoutData = null;
      return;
    }

    try {
      const r = await fetch(`/api/layouts/${idNum}`, { credentials:"include" });
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
  // UI: селект схемы
  // =========================
  function updateLayoutSelect() {
    const sel = $("#layout-select");
    if (!sel) return;

    sel.innerHTML = "";

    // всегда первая опция — дефолт
    {
      const optDefault = document.createElement("option");
      optDefault.value = "default";
      optDefault.textContent = "Дефолтная схема";
      if (LayoutState.currentLayoutId === "default") {
        optDefault.selected = true;
      }
      sel.appendChild(optDefault);
    }

    // затем — реальные схемы из бэка
    LayoutState.layouts.forEach(l => {
      const opt = document.createElement("option");
      opt.value = String(l.id);

      // подпись опции: "[этаж N · ]<имя>" или "схема <id>"
      const floorLabel =
        (l.floorNumber !== undefined && l.floorNumber !== null)
          ? ("этаж " + l.floorNumber + " · ")
          : "";

      opt.textContent = l.name
        ? (floorLabel + l.name)
        : ("схема " + l.id);

      if (String(l.id) === String(LayoutState.currentLayoutId)) {
        opt.selected = true;
      }

      sel.appendChild(opt);
    });

    sel.disabled = false;
  }

  function bindLayoutChangeHandler() {
    const layoutSel = $("#layout-select");
    if (!layoutSel) return;

    layoutSel.addEventListener("change", async (ev) => {
      const newLayoutId = ev.target.value;

      // обновляем state
      LayoutState.currentLayoutId = newLayoutId || "default";

      // заново тянем данные по схеме (если не дефолт)
      await loadCurrentLayoutFull();

      // обновляем заголовок
      applyHeaderInfo();

      // перерисовываем план здания
      renderBuildingPlanFromLayout();

      // после перерисовки плана надо повесить хэндлеры
      initFloorSwitch();
      initRooms();
      attachRefreshHandlers();
      refreshOccupancy();
    });
  }

  // =========================
  // UI: заголовок и кнопка "Конструктор плана"
  // =========================
  function applyHeaderInfo() {
    const lNameSpan = $("#current-layout-name");
    const editBtn   = $("#to-editor-btn");

    if (LayoutState.currentLayoutId === "default") {
      // дефолтный вариант
      if (lNameSpan) {
        lNameSpan.textContent = "Дефолтная схема";
      }
      if (editBtn) {
        // без layoutId — просто редактор
        editBtn.href = "/app/layout-editor.html";
      }
      return;
    }

    // ищем объект схемы по id
    const lObj = LayoutState.layouts.find(
      l => String(l.id) === String(LayoutState.currentLayoutId)
    );

    if (lNameSpan) {
      if (lObj) {
        const floorLabel =
          (lObj.floorNumber !== undefined && lObj.floorNumber !== null)
            ? "этаж " + lObj.floorNumber + " · "
            : "";
        lNameSpan.textContent = lObj.name
          ? (floorLabel + lObj.name)
          : ("схема " + lObj.id);
      } else {
        lNameSpan.textContent = "—";
      }
    }

    if (editBtn) {
      const floorParam =
        lObj && lObj.floorNumber != null ? lObj.floorNumber : "";
      const layoutNameParam =
        lObj && lObj.name ? encodeURIComponent(lObj.name) : "";
      editBtn.href =
        "/app/layout-editor.html"
        + "?layoutId=" + encodeURIComponent(LayoutState.currentLayoutId)
        + "&floor=" + encodeURIComponent(floorParam)
        + "&name=" + layoutNameParam;
    }
  }

  // =========================
  // Рендер плана из выбранной схемы
  // =========================
  function renderBuildingPlanFromLayout() {
    const container = $("#building-plan");
    if (!container) return;

    // если выбрана дефолтная схема -> не трогаем HTML вообще
    if (LayoutState.currentLayoutId === "default") {
      return;
    }

    // если схему не удалось загрузить или нет layoutJson -> тоже не трогаем
    if (!LayoutState.currentLayoutData || !LayoutState.currentLayoutData.layoutJson) {
      return;
    }

    // парсим layoutJson
    let parsed;
    try {
      parsed = JSON.parse(LayoutState.currentLayoutData.layoutJson);
    } catch (e) {
      console.error("layoutJson не парсится:", e, LayoutState.currentLayoutData.layoutJson);
      return;
    }

    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
    const roomsOnly = elements.filter(el => el.type === "room");

    // В простом варианте считаем, что это один этаж = floorNumber
    const floorNum = LayoutState.currentLayoutData.floorNumber ?? "—";

    // Строим минималистичный блок: один "этаж" и список аудиторий-кнопок
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
          + '</div>'   // .floor
        + '</section>'
      + '</div>'       // .wings
    );

    container.innerHTML = htmlParts.join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================
  // Переключалка этажей (кнопки 1 / 2 / 3)
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
  // Фильтр по факультету / специальности
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

  // =========================
  // Клики по аудиториям -> выездная панель бронирования
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
        const floorEl  = btn.closest(".floor");
        const floor    = Number(floorEl?.dataset.floor || 1);

        const slotSel = $("#slot-filter");
        const slot = {
          id: Number(slotSel?.value || 0),
          label: slotSel?.selectedOptions?.[0]?.textContent || "—"
        };

        // настройки серии
        const sched = window.SchedulePanel?.getSettings?.() || {
          dayOfWeek:"", weekParityType:"ANY"
        };
        const wtSel = $("#sch-weektype")?.value;
        const weekParityType = wtSel || sched.weekParityType || "ANY";

        // если dayOfWeek не выставлен панелью, берём из даты
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
  // Подсветка загрузки аудиторий
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

    // единый агрегирующий запрос на слот:
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
    if (!myOnly) params.set("slim","true"); // облегчённые ответы для общего поиска
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

  // =========================
  // Утилиты
  // =========================
  function classroomIdFromRoom(roomName){
    // пробуем вытащить трёхзначный номер аудитории (101, 204, 311 ...)
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);

    // fallback: хэш имени
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

  // экспортируем для других модулей (teacher-schedule и т.п.)
  window.planRefreshOccupancy = refreshOccupancy;

  // =========================
  // ГЛАВНЫЙ READY
  // =========================
  ready(async () => {
    // 0. Заполнить селект схем + отрисовать initial план
    await initLayoutsFlow();

    // 1. Инициализировать панель расписания преподавателя (если есть)
    window.SchedulePanel?.init?.();

    // 2. Переключалка этажей
    initFloorSwitch();

    // 3. Подгрузить слоты (пары)
    await initSlots();

    // 4. Проставить сегодняшнюю дату
    initDateField();

    // 5. Подготовить тайм-зоны
    initTimeZones();

    // 6. Навесить клики по аудиториям
    initRooms();

    // 7. Подтянуть группы и метаданные аудиторий (для фильтра и подсветки)
    await Promise.all([loadGroups(), loadRoomsMeta()]);

    // 8. Инициализировать фильтр аудиториям
    initFilterMenu();

    // 9. Навесить обработчики обновления подсветки и сразу её посчитать
    attachRefreshHandlers();
    refreshOccupancy();
  });

})();

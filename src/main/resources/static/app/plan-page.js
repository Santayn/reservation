// plan-page.js
// Подсветка заполненности аудиторий + фильтр по факультету/спецу.
// Тайм-зоны: фиксированные UTC±HH:MM без DST (в value уже "UTC+03:00").
// Схемы:
//
//   - В выпадающем списке "Схема:" ПЕРВОЙ идёт "Дефолтная схема" (это просто верстка из HTML, без layoutJson).
//   - Далее идут реальные схемы, полученные с бэка или из localStorage редактора.
//   - Корпус визуально НЕ показываем, но под капотом мы всё ещё можем брать схемы с бэка,
//     как раньше: /api/buildings -> /api/layouts/by-building/{id}.
//
// Важно:
//   - Если у тебя бекенд не даёт /api/layouts напрямую, мы автоматически упадём на
//     /api/buildings и возьмём схемы первого корпуса через /api/layouts/by-building/{buildingId}.
//   - Если и там пусто, попробуем localStorage.

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

  // ===== Глобальные кэши (общие с другими модулями) =====
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

  // ===== STATE для схем =====
  // UI корпуса нет, но нам всё ещё нужно знать "какой корпус мы выбрали первым".
  // internalBuildingId — просто скрытый выбранный корпус с бэка.
  const LayoutState = {
    internalBuildingId: null, // number | null
    buildings: [],            // [{id,name}, ...] (для внутреннего использования)
    layouts: [],              // [{id,name,floorNumber,layoutJson?}, ...] БЕЗ дефолтной
    currentLayoutId: null,    // "static-default" (дефолтная) ИЛИ конкретный ID схемы
    currentLayoutData: null   // полная схема {id,name,floorNumber,layoutJson} если выбрана не дефолтная
  };

  // =========================
  // Основной ready() сценарий
  // =========================
  ready(async () => {
    // 0. Схемы
    await initLayoutsFlow();

    // 1. Панель расписания (если есть)
    window.SchedulePanel?.init?.();

    // 2. Переключалка этажей
    initFloorSwitch();

    // 3. Слоты
    await initSlots();

    // 4. Дата сегодня
    initDateField();

    // 5. Тайм-зоны
    initTimeZones();

    // 6. Навесить клики по аудиториям
    initRooms();

    // 7. Подтянуть справочники групп и аудиторий
    await Promise.all([loadGroups(), loadRoomsMeta()]);

    // 8. Фильтр по факультету/спецу
    initFilterMenu();

    // 9. Подсветка занятости
    attachRefreshHandlers();
    refreshOccupancy();
  });

  // =========================
  // СХЕМЫ (главное)
  // =========================

  async function initLayoutsFlow() {
    // 1. Загрузим схемы (и корпуса, если надо)
    await loadAllLayoutsSmart();

    // 2. Если ничего не выбрано — выберем дефолтную схему
    if (!LayoutState.currentLayoutId) {
      LayoutState.currentLayoutId = "static-default";
    }

    // 3. Отрисуем селект схем (включая "Дефолтная схема" первым пунктом)
    updateLayoutSelect();

    // 4. Синхронизируем данные по выбранной схеме (если она не дефолт)
    await syncCurrentLayoutData();

    // 5. Заголовок / кнопка "Конструктор плана"
    applyHeaderInfo();

    // 6. Если выбрана не дефолтная схема — перерисуем план
    renderBuildingPlanFromLayout();

    // 7. Навесим обработчик смены схемы
    bindLayoutChangeHandler();
  }

  // универсальная загрузка схем:
  //  - пробуем /api/layouts
  //  - если пусто -> тянем /api/buildings, берём первый, тянем /api/layouts/by-building/{id}
  //  - если всё равно пусто -> берём localStorage
  async function loadAllLayoutsSmart() {
    // попробуем прямой список схем
    let layoutsFromApi = [];
    layoutsFromApi = await tryFetchLayoutsDirect();
    if (layoutsFromApi.length === 0) {
      // нет прямого списка — пробуем через корпуса
      const { buildingId, layouts } = await tryFetchLayoutsViaBuildings();
      LayoutState.internalBuildingId = buildingId;
      layoutsFromApi = layouts;
    }

    // если всё ещё пусто — попробуем localStorage редактора
    if (layoutsFromApi.length === 0) {
      layoutsFromApi = readLocalEditorSaves();
    }

    // сохраним корпуса / layouts в стейт
    LayoutState.layouts = layoutsFromApi.map(it => normalizeLayout(it));
  }

  // пробуем /api/layouts или /api/layouts?size=1000
  async function tryFetchLayoutsDirect() {
    const candidates = ["/api/layouts", "/api/layouts?size=1000"];
    for (const url of candidates) {
      try {
        const r = await fetch(url, { credentials:"include" });
        if (!r.ok) continue;
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
        if (arr && arr.length) {
          return arr;
        }
      } catch (e) {
        // просто молчим и пробуем следующий
      }
    }
    return [];
  }

  // пробуем /api/buildings -> layouts/by-building/{id}
  async function tryFetchLayoutsViaBuildings() {
    let buildings = [];
    try {
      const rb = await fetch("/api/buildings", { credentials:"include" });
      if (rb.ok) {
        const dataB = await rb.json();
        buildings = Array.isArray(dataB) ? dataB : (Array.isArray(dataB.content) ? dataB.content : []);
      }
    } catch (e) {
      // ignore
    }
    LayoutState.buildings = buildings;

    if (!buildings.length) {
      return { buildingId:null, layouts:[] };
    }

    // берём первый корпус как "активный" невидимый
    const firstB = buildings[0];
    const bId = firstB?.id ?? firstB?.buildingId ?? firstB?.building_id ?? null;
    if (bId == null) {
      return { buildingId:null, layouts:[] };
    }

    let layouts = [];
    try {
      const rl = await fetch(`/api/layouts/by-building/${bId}`, { credentials:"include" });
      if (rl.ok) {
        const dataL = await rl.json();
        layouts = Array.isArray(dataL) ? dataL : (Array.isArray(dataL.content) ? dataL.content : []);
      }
    } catch (e2) {
      // ignore
    }

    return {
      buildingId: bId,
      layouts
    };
  }

  // локальные черновики из редактора
  function readLocalEditorSaves() {
    const out = [];

    // формат: le:saves = массив
    try {
      const raw = localStorage.getItem("le:saves");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const it of arr) {
            if (!it) continue;
            out.push({
              id: it.id ?? it.layoutId ?? it.key ?? Date.now(),
              name: it.name || `Локальная схема`,
              floorNumber: it.floorNumber ?? it.floor ?? 1,
              layoutJson: it.layoutJson || JSON.stringify({ elements: it.elements || [] })
            });
          }
        }
      }
    } catch(e){
      // ignore
    }

    // формат: le:save:<id> = по одной схеме
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("le:save:")) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const it = JSON.parse(raw);
          out.push({
            id: it.id ?? it.layoutId ?? k.slice("le:save:".length),
            name: it.name || `Локальная схема`,
            floorNumber: it.floorNumber ?? it.floor ?? 1,
            layoutJson: it.layoutJson || JSON.stringify({ elements: it.elements || [] })
          });
        } catch(e2){
          // ignore
        }
      }
    } catch(e3){
      // нет доступа к localStorage.length? тогда просто пропустим
    }

    // уберём дубли
    const uniq = new Map();
    for (const it of out) {
      uniq.set(String(it.id), it);
    }
    return Array.from(uniq.values());
  }

  // нормализуем объект схемы в единый формат
  function normalizeLayout(raw) {
    const idVal = raw.id ?? raw.layoutId ?? raw.key ?? Date.now();
    const floorNum = raw.floorNumber ?? raw.floor ?? null;
    return {
      id: String(idVal),
      name: raw.name || raw.title || `Схема ${idVal}`,
      floorNumber: floorNum,
      layoutJson: raw.layoutJson
        || raw.layoutJSON
        || JSON.stringify({ elements: raw.elements || [] })
    };
  }

  // загружаем полные данные по текущей схеме (если она не дефолтная)
  async function syncCurrentLayoutData() {
    if (LayoutState.currentLayoutId === "static-default") {
      LayoutState.currentLayoutData = null;
      return;
    }

    // сначала попробуем взять данные прямо из LayoutState.layouts
    const local = LayoutState.layouts.find(
      l => String(l.id) === String(LayoutState.currentLayoutId)
    );
    if (local) {
      LayoutState.currentLayoutData = { ...local };
    }

    // потом попробуем обновить с бэка /api/layouts/{id}
    try {
      const r = await fetch(`/api/layouts/${LayoutState.currentLayoutId}`, { credentials:"include" });
      if (r.ok) {
        const full = await r.json();
        LayoutState.currentLayoutData = {
          id: String(full.id ?? LayoutState.currentLayoutId),
          name: full.name || full.title || (local ? local.name : `Схема ${LayoutState.currentLayoutId}`),
          floorNumber: full.floorNumber ?? full.floor ?? (local ? local.floorNumber : null),
          layoutJson: full.layoutJson
            || full.layoutJSON
            || (local ? local.layoutJson : null)
        };
      }
    } catch (e){
      // если запрос не удался — остаёмся на local
    }
  }

  // =========================
  // UI: селект схем
  // =========================

  function updateLayoutSelect() {
    const sel = $("#layout-select");
    if (!sel) return;

    sel.innerHTML = "";

    // 1. "Дефолтная схема" всегда первая
    const defOpt = document.createElement("option");
    defOpt.value = "static-default";
    defOpt.textContent = "Дефолтная схема";
    if (LayoutState.currentLayoutId === "static-default") {
      defOpt.selected = true;
    }
    sel.appendChild(defOpt);

    // 2. Остальные схемы (если есть)
    if (LayoutState.layouts.length > 0) {
      LayoutState.layouts.forEach(l => {
        const opt = document.createElement("option");
        opt.value = String(l.id);

        const floorLabel =
          (l.floorNumber !== undefined && l.floorNumber !== null && l.floorNumber !== "")
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
    }

    sel.disabled = false;
  }

  // =========================
  // UI: заголовок и кнопка "Конструктор плана"
  // =========================

  function applyHeaderInfo() {
    const lNameSpan = $("#current-layout-name");
    const editBtn   = $("#to-editor-btn");

    const lObj = LayoutState.layouts.find(
      l => String(l.id) === String(LayoutState.currentLayoutId)
    );

    if (lNameSpan) {
      if (LayoutState.currentLayoutId === "static-default") {
        lNameSpan.textContent = "Дефолтная схема";
      } else if (lObj) {
        const floorLabel =
          (lObj.floorNumber !== undefined && lObj.floorNumber !== null && lObj.floorNumber !== "")
            ? ("этаж " + lObj.floorNumber + " · ")
            : "";
        lNameSpan.textContent = lObj.name
          ? (floorLabel + lObj.name)
          : ("схема " + lObj.id);
      } else {
        lNameSpan.textContent = "—";
      }
    }

    if (editBtn) {
      if (LayoutState.currentLayoutId === "static-default") {
        // дефолт -> просто открыть редактор пустым
        editBtn.href = "/app/layout-editor.html";
      } else if (lObj) {
        const floorParam = lObj.floorNumber != null ? lObj.floorNumber : "";
        const layoutNameParam = lObj.name ? encodeURIComponent(lObj.name) : "";
        editBtn.href =
          "/app/layout-editor.html"
          + "?floor=" + floorParam
          + "&name=" + layoutNameParam
          + "&layoutId=" + encodeURIComponent(LayoutState.currentLayoutId);
      } else {
        editBtn.href = "/app/layout-editor.html";
      }
    }
  }

  // =========================
  // Рендер плана текущей схемы в #building-plan
  // =========================
  // Если выбрана "Дефолтная схема" -> не меняем твою статичную верстку.
  // Иначе заменяем DOM на список аудиторий из layoutJson (type: "room").
  function renderBuildingPlanFromLayout() {
    const container = $("#building-plan");
    if (!container) return;

    if (LayoutState.currentLayoutId === "static-default") {
      // оставить исходный HTML
      return;
    }

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

    const floorNum = LayoutState.currentLayoutData.floorNumber ?? "—";

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

    // После замены DOM навесим интерактив заново
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
  // Обработчик смены схемы
  // =========================
  function bindLayoutChangeHandler() {
    const layoutSel = $("#layout-select");
    if (!layoutSel) return;

    layoutSel.addEventListener("change", async (ev) => {
      const newLayoutId = ev.target.value;
      LayoutState.currentLayoutId = newLayoutId || "static-default";

      await syncCurrentLayoutData();
      applyHeaderInfo();
      renderBuildingPlanFromLayout();
    });
  }

  // =========================
  // Этажи
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
      floors.forEach(f => {
        f.classList.toggle("active", f.dataset.floor === String(num));
      });
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
  // Тайм-зоны (фиксированные UTC оффсеты)
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
  // Фильтр по факультету / специализации
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
        const floorEl  = btn.closest(".floor");
        const floor    = Number(floorEl?.dataset.floor || 1);

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
  // Подсветка заполненности
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

    const usedByRoom = new Map(); // classroomId -> суммарное число людей
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

  // Цвета занятости:
  // - idle   пусто
  // - ok     ≤100%
  // - warn   до +25%
  // - danger до +50%
  // - over   > +50%
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
    // Если в названии есть ### — считаем это ID аудитории
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);

    // иначе стабильно хэшируем имя
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

  // экспортируем для внешнего вызова, если нужно
  window.planRefreshOccupancy = refreshOccupancy;

})();

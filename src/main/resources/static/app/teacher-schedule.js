// /app/teacher-schedule.js
// Расписание текущего пользователя (преподавателя).
// Источники:
//   - /api/bookings/my — только мои брони
//   - /api/groups       — имена групп и численность
//   - /api/classrooms   — метаданные аудиторий (floor, buildingId, name, corpus и т.д.)
//   - /api/buildings    — справочник корпусов
//
// Для выбранного типа недели печатаем все дни и пары.
// В каждой паре показываем корпус (человеческое имя) и этаж.
// По клику на пару:
//   1) переключаем фильтры (чётность/день/слот)
//   2) переключаем селекты "Здание / корпус" и "Этаж (схема)"
//   3) подсвечиваем аудиторию на плане + перекрашиваем занятость.

(function () {
  "use strict";
  if (window.__TS_INIT__) return;
  window.__TS_INIT__ = true;

  const $    = (s, r) => (r || document).querySelector(s);
  const $all = (s, r) => Array.from((r || document).querySelectorAll(s));

  const WEEK_TYPES = [
    { value: "ANY",  label: "Обычная (без чётности)" },
    { value: "EVEN", label: "Чётная" },
    { value: "ODD",  label: "Нечётная" },
  ];
  const DAYS = [
    { value: "MONDAY",    label: "Понедельник" },
    { value: "TUESDAY",   label: "Вторник" },
    { value: "WEDNESDAY", label: "Среда" },
    { value: "THURSDAY",  label: "Четверг" },
    { value: "FRIDAY",    label: "Пятница" },
    { value: "SATURDAY",  label: "Суббота" },
    { value: "SUNDAY",    label: "Воскресенье" },
  ];
  const wtByValue = new Map(WEEK_TYPES.map(w => [w.value, w]));

  // кэши (часть уже создаётся в plan-page.js)
  const RoomsMeta      = window.RoomsMeta      || { byId:new Map(), byName:new Map(), loaded:false };
  const GroupsCache    = window.GroupsCache    || { byId:new Map(), loaded:false };
  const TeachersCache  = window.TeachersCache  || { byId:new Map(), loaded:false };
  const BuildingsCache = window.BuildingsCache || { byId:new Map(), list:[], loaded:false };

  // =========================
  // helpers
  // =========================
  function firstText(...vals){
    for (const v of vals){
      const s = v == null ? "" : String(v).trim();
      if (s) return s;
    }
    return "";
  }

  function groupDisplayName(groupObj, id){
    return firstText(
      groupObj?.name,
      groupObj?.title,
      groupObj?.groupName,
      groupObj?.shortName,
      groupObj?.code,
      groupObj?.number,
      groupObj?.label
    ) || `Группа ${id}`;
  }

  function teacherDisplayName(teacherObj, id) {
    return firstText(
      teacherObj?.fullName,
      teacherObj?.name,
      teacherObj?.login,
      teacherObj?.username
    ) || `Преподаватель ${id}`;
  }

  function groupsCacheHasDisplayNames() {
    return Array.from(GroupsCache.byId?.values?.() || [])
      .some((g) => !!firstText(
        g?.name,
        g?.title,
        g?.groupName,
        g?.shortName,
        g?.code,
        g?.number,
        g?.label
      ));
  }

  function formatTime(isoLike){
    if (!isoLike) return "??:??";
    const d = new Date(String(isoLike).replace(" ","T"));
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  function mergeScheduleRows(rows) {
    const byPlace = new Map();

    for (const row of rows) {
      const roomKey = Number.isFinite(row.classroomId)
        ? `id:${row.classroomId}`
        : `place:${row.buildingId ?? ""}|${row.floorNum}|${row.roomName}`;
      const key = `${row.slotId}|${roomKey}`;

      let merged = byPlace.get(key);
      if (!merged) {
        merged = {
          ...row,
          groupNames: [],
          groupNameSet: new Set()
        };
        byPlace.set(key, merged);
      }

      if (row.groupName && !merged.groupNameSet.has(row.groupName)) {
        merged.groupNameSet.add(row.groupName);
        merged.groupNames.push(row.groupName);
      }
    }

    return Array.from(byPlace.values()).map((row) => {
      row.groupNames.sort((a, b) => a.localeCompare(b, "ru"));
      const groupName = row.groupNames.join(", ");
      delete row.groupNameSet;
      return {
        ...row,
        groupName,
        groupNames: row.groupNames
      };
    });
  }

  // какая чётность недели сейчас выбрана в панели слева над планом
  function currentWeekType() {
    return window.SchedulePanel?.getSettings?.()?.weekParityType
        || $("#sch-weektype")?.value
        || "ANY";
  }

  // ставим фильтры неделя/день/слот в панели
  function setScheduleControls({ weekType, day, slotId }) {
    const wtSel   = $("#sch-weektype");
    const daySel  = $("#sch-day");
    const slotSel = $("#slot-filter");
    const weeklyMode = $("#sch-mode-weekly");
    const parityMode = $("#sch-mode-parity");

    if (weekType === "ANY") {
      if (weeklyMode) weeklyMode.checked = true;
      if (parityMode) parityMode.checked = false;
    } else {
      if (weeklyMode) weeklyMode.checked = false;
      if (parityMode) parityMode.checked = true;
    }

    if (wtSel) {
      wtSel.value = weekType;
      wtSel.dispatchEvent(new Event("change", { bubbles:true }));
    }
    if (daySel) {
      daySel.value = day;
      daySel.dispatchEvent(new Event("change", { bubbles:true }));
    }
    if (slotSel) {
      slotSel.value = String(slotId);
      slotSel.dispatchEvent(new Event("change", { bubbles:true }));
    }
  }

  // подсветить аудиторию на плане и перекрасить занятость
  function highlightAndRefresh(roomName){
    if (typeof window.planHighlightRoom === "function") {
      window.planHighlightRoom(roomName);
    }
    if (typeof window.planRefreshOccupancy === "function") {
      window.planRefreshOccupancy();
    }
  }
  // чуть позже повторим (чтобы план успел переключиться на нужный корпус/этаж)
  function delayedHighlight(roomName){
    highlightAndRefresh(roomName);
    setTimeout(() => highlightAndRefresh(roomName), 300);
  }

  // =========================
  // работа со слотами
  // =========================
  function slotMapFromSelect() {
    // пробуем взять уже отрисованные <option> из #slot-filter
    const map = new Map();
    const sel = $("#slot-filter");
    if (!sel) return map;
    for (const opt of sel.options) {
      const id = Number(opt.value || 0);
      if (!id) continue;
      map.set(id, { id, label: opt.textContent.trim() });
    }
    return map;
  }

  async function loadSlotsFromApi() {
    // бэкап, если слот-селект ещё пустой
    try {
      const r = await fetch("/api/schedule/slots", { credentials:"include" });
      if (!r.ok) return new Map();
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      const map = new Map();
      for (const s of arr) {
        const id = Number(s.id ?? s.slotId ?? s.slot_id);
        if (!id) continue;
        const start = s.startAt ?? s.start_at ?? s.start;
        const end   = s.endAt   ?? s.end_at   ?? s.end;
        map.set(id, { id, label: `${formatTime(start)} – ${formatTime(end)}` });
      }
      return map;
    } catch {
      return new Map();
    }
  }

  // =========================
  // ensure caches (гарантированно заполняем кэши)
  // =========================
  async function ensureGroupsLoaded(){
    if (GroupsCache.loaded && GroupsCache.byId && GroupsCache.byId.size && groupsCacheHasDisplayNames()) return;
    try{
      const r = await fetch("/api/groups?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      const byId = new Map();
      for (const g of arr){
        const gid = Number(g.id);
        byId.set(gid, {
          id: gid,
          name: firstText(
            g.name, g.title, g.groupName, g.shortName,
            g.code, g.number, g.label
          ),
          personsCount: Number(g.personsCount || 0)
        });
      }
      GroupsCache.byId = byId;
    } catch {
      // игнорируем, просто оставим пусто
    } finally {
      GroupsCache.loaded = true;
      window.GroupsCache = GroupsCache;
    }
  }

  async function ensureRoomsMetaLoaded(){
    if (RoomsMeta.loaded && RoomsMeta.byId && RoomsMeta.byId.size) return;
    try{
      const r = await fetch("/api/classrooms?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      for (const c of arr){
        const pk = Number(c.id);
        const nm = firstText(c.name);
        const meta = {
          id: pk,
          name: nm,
          floor: Number(c.floor ?? 0),
          buildingId: (c.buildingId != null ? Number(c.buildingId) : null),
          corpus: c.corpus || c.building || "" // подпись корпуса, если есть прямо у аудитории
        };
        RoomsMeta.byId.set(pk, meta);
        if (nm) RoomsMeta.byName.set(nm, meta);
      }
    } catch {
      // игнорируем
    } finally {
      RoomsMeta.loaded = true;
    }
  }

  async function ensureBuildingsLoaded(){
    if (BuildingsCache.loaded && BuildingsCache.byId && BuildingsCache.byId.size) return;
    try{
      const r = await fetch("/api/buildings", { credentials:"include" });
      if (!r.ok) throw 0;
      const list = await r.json();
      const arr = Array.isArray(list) ? list : [];
      BuildingsCache.list = arr;
      BuildingsCache.byId = new Map(
        arr.map(b => [
          Number(b.id),
          {
            id: Number(b.id),
            name: firstText(b.name, b.title) || `Корпус ${b.id}`
          }
        ])
      );
    } catch {
      // игнорируем
    } finally {
      BuildingsCache.loaded = true;
    }
  }

  async function ensureTeachersLoaded(){
    if (TeachersCache.loaded && TeachersCache.byId && TeachersCache.byId.size) return;
    try{
      const r = await fetch("/api/teachers?size=1000", { credentials:"include" });
      if (!r.ok) throw 0;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      TeachersCache.byId = new Map(arr.map(t => [
        Number(t.id),
        {
          id: Number(t.id),
          login: firstText(t.login, t.username),
          fullName: firstText(t.fullName, t.name)
        }
      ]));
    } catch {
      // игнорируем
    } finally {
      TeachersCache.loaded = true;
      window.TeachersCache = TeachersCache;
    }
  }

  // =========================
  // bookings cache (мои пары)
  // =========================
  const bookingsCache = new Map(); // key -> Promise<{_error?, data:Booking[]}>
  const cacheKey = (day, week, slotId) => `${day}|${week}|${slotId}`;

  async function fetchMyBookings(dayOfWeek, weekParityType, slotId) {
    const k = cacheKey(dayOfWeek, weekParityType, slotId);
    if (bookingsCache.has(k)) return bookingsCache.get(k);

    const params = new URLSearchParams({
      dayOfWeek,
      weekParityType,
      slotId: String(slotId)
    });

    const p = fetch(`/api/bookings/my?${params.toString()}`, {
      credentials:"include"
    })
    .then(async r => {
      if (r.status === 401) {
        return { _error: "unauth", data: [] };
      }
      if (!r.ok) {
        return { data: [] };
      }
      return { data: await r.json() };
    })
    .catch(() => ({ data: [] }));

    bookingsCache.set(k, p);
    return p;
  }

  async function fetchGroupBookings(groupId, dayOfWeek, weekParityType, slotId) {
    if (!Number.isFinite(Number(groupId))) {
      return { data: [] };
    }

    const params = new URLSearchParams({
      dayOfWeek,
      weekParityType,
      slotId: String(slotId)
    });

    return fetch(`/api/bookings/group/${groupId}?${params.toString()}`, {
      credentials:"include"
    })
    .then(async r => {
      if (!r.ok) {
        return { data: [] };
      }
      return { data: await r.json() };
    })
    .catch(() => ({ data: [] }));
  }

  // =========================
  // имя корпуса (человеческое)
  // =========================
  // приоритет:
  // 1) текст из опции <select id="building-select">, если там есть такой buildingId
  // 2) BuildingsCache.byId[buildingId].name
  // 3) rm.corpus (подпись корпуса из самой аудитории)
  // 4) "Корпус {id}" / "Корпус"
  function resolveBuildingName(buildingId, rm) {
    // 1. живой селект на странице
    if (buildingId != null) {
      const bSel = document.getElementById("building-select");
      if (bSel) {
        const opt = Array.from(bSel.options)
          .find(o => String(o.value) === String(buildingId));
        if (opt) {
          const txt = (opt.textContent || "").trim();
          if (txt) {
            return txt;
          }
        }
      }
    }

    // 2. кеш зданий с бэка
    if (buildingId != null) {
      const bMeta = BuildingsCache.byId.get(buildingId);
      if (bMeta && bMeta.name && bMeta.name.trim()) {
        return bMeta.name.trim();
      }
    }

    // 3. corpus из RoomsMeta (м.б. "ф", "а", "Главный", и т.д.)
    if (rm && rm.corpus && String(rm.corpus).trim()) {
      return String(rm.corpus).trim();
    }

    // 4. запасной вариант
    if (buildingId != null) {
      return `Корпус ${buildingId}`;
    }
    return "Корпус";
  }

  // =========================
  // переключение корпуса и этажа наверху плана
  // =========================
  function pickBuildingAndFloor(buildingId, floorNum) {
    const bSel = document.getElementById("building-select");
    if (!bSel) return;

    // 1. выбрать здание/корпус
    if (buildingId != null) {
      const newVal = String(buildingId);
      if (bSel.value !== newVal) {
        bSel.value = newVal;
        bSel.dispatchEvent(new Event("change", { bubbles:true }));
      }
    }

    // 2. когда layouts обновятся после change корпуса,
    //    пытаемся выбрать схему с нужным этажом
    setTimeout(() => {
      const lSel = document.getElementById("layout-select");
      if (!lSel) return;

      let picked = false;

      if (Number.isFinite(floorNum)) {
        const prefix = `этаж ${floorNum}`;
        for (const opt of lSel.options) {
          const label = (opt.textContent || "").trim();
          if (label.startsWith(prefix)) {
            if (lSel.value !== opt.value) {
              lSel.value = opt.value;
              lSel.dispatchEvent(new Event("change", { bubbles:true }));
            }
            picked = true;
            break;
          }
        }
      }

      // fallback: просто первый реальный layout
      if (!picked) {
        const firstReal = Array.from(lSel.options)
          .find(o => (o.value ?? "") !== "");
        if (firstReal && lSel.value !== firstReal.value) {
          lSel.value = firstReal.value;
          lSel.dispatchEvent(new Event("change", { bubbles:true }));
        }
      }
    }, 150);
  }

  // =========================
  // отрисовка расписания
  // =========================
  let buildVersion = 0;
  let groupBuildVersion = 0;

  function fillGroupScheduleSelect() {
    const sel = $("#group-schedule-select");
    if (!sel) return;

    const current = sel.value;
    const groups = Array.from(GroupsCache.byId?.values?.() || [])
      .filter((g) => Number.isFinite(Number(g.id)))
      .sort((a, b) =>
        groupDisplayName(a, a.id).localeCompare(groupDisplayName(b, b.id), "ru")
      );

    sel.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— выберите группу —";
    sel.appendChild(empty);

    for (const g of groups) {
      const opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = groupDisplayName(g, g.id);
      sel.appendChild(opt);
    }

    if (groups.some((g) => String(g.id) === current)) {
      sel.value = current;
    }
  }

  async function buildFullSchedule() {
    const myVersion = ++buildVersion;

    const block = $("#teacher-schedule-block");
    const list  = $("#teacher-schedule-list");
    const empty = $("#teacher-schedule-empty");
    const title = block?.querySelector("h3");
    if (!block || !list || !empty) return;

    // убедимся, что все кэши есть
    await Promise.all([
      ensureGroupsLoaded(),
      ensureRoomsMetaLoaded(),
      ensureBuildingsLoaded()
    ]);

    list.innerHTML = "";
    empty.style.display = "none";
    block.hidden = false;

    // подпись блока
    const wtVal = currentWeekType();
    const wtObj = wtByValue.get(wtVal) || { value: wtVal, label: wtVal };
    if (title) {
      title.textContent = `Моё расписание — ${wtObj.label}`;
    }

    // карта слотов
    let slotMap = slotMapFromSelect();
    if (!slotMap.size) {
      slotMap = await loadSlotsFromApi();
    }
    if (!slotMap.size) {
      list.innerHTML = `<div class="muted">Слоты не найдены.</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    const weekSection = document.createElement("section");
    weekSection.className = "ts-weektype";
    weekSection.innerHTML = `<h4 style="margin-top:14px">${wtObj.label}</h4>`;
    const weekBox = document.createElement("div");
    weekBox.className = "ts-weekbox";
    weekSection.appendChild(weekBox);

    // по дням недели
    for (const day of DAYS) {
      let rows = [];

      for (const [slotId, slotInfo] of slotMap.entries()) {
        /* eslint-disable no-await-in-loop */
        const { _error, data } = await fetchMyBookings(day.value, wtObj.value, slotId);
        if (_error === "unauth") {
          list.innerHTML = `<div class="muted">Не авторизован. Войдите, чтобы увидеть своё расписание.</div>`;
          return;
        }
        /* eslint-enable no-await-in-loop */

        for (const b of data) {
          const classroomPk = Number(b.classroomId);
          const rm = RoomsMeta.byId.get(classroomPk);
          if (!rm) continue;

          // этаж и здание берём в приоритете из брони, иначе из карточки аудитории
          const floorNumRaw = (b.floor != null ? Number(b.floor) : rm.floor);
          const floorNum = Number.isFinite(floorNumRaw) ? floorNumRaw : 0;

          const buildingIdRaw = (b.buildingId != null ? Number(b.buildingId) : rm.buildingId);
          const buildingId = Number.isFinite(buildingIdRaw) ? buildingIdRaw : null;

          // красивое имя корпуса
          const buildingName = resolveBuildingName(buildingId, rm);

          const gid   = Number(b.groupId);
          const gObj  = GroupsCache.byId.get?.(gid);
          const gName = groupDisplayName(gObj, gid);

          rows.push({
            slotId,
            slotLabel: slotInfo.label,
            classroomId: classroomPk,
            buildingId,
            buildingName,
            floorNum,
            roomName: firstText(rm.name) || `Ауд. ${classroomPk}`,
            groupName: gName
          });
        }
      }

      if (!rows.length) {
        continue;
      }
      rows = mergeScheduleRows(rows);

      // сортировка занятий внутри дня
      rows.sort((a,b) =>
        (a.slotId - b.slotId) ||
        a.buildingName.localeCompare(b.buildingName, "ru") ||
        (a.floorNum - b.floorNum) ||
        a.roomName.localeCompare(b.roomName, "ru") ||
        a.groupName.localeCompare(b.groupName, "ru")
      );

      // верстка дня
      const dayWrap = document.createElement("div");
      dayWrap.className = "ts-day";
      dayWrap.innerHTML = `<h5 style="margin:8px 0 4px">${day.label}</h5>`;

      const tableWrap = document.createElement("div");
      tableWrap.className = "ts-table-wrap";

      const table = document.createElement("table");
      table.className = "ts-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Пара</th>
            <th>Корпус</th>
            <th>Этаж</th>
            <th>Аудитория</th>
            <th>Группа</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");
      tableWrap.appendChild(table);
      dayWrap.appendChild(tableWrap);

      for (const it of rows) {
        const row = document.createElement("tr");
        row.className = "ts-item ts-table-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `${day.label}: ${it.slotLabel}, ${it.roomName}`);

        // пример строки:
        // 08:00 – 09:30 — ф, 2 эт., Ауд. 101 • гр. 23кб
        const slotCell = document.createElement("td");
        slotCell.className = "ts-slot";
        slotCell.textContent = it.slotLabel;

        const buildingCell = document.createElement("td");
        buildingCell.textContent = it.buildingName;

        const floorCell = document.createElement("td");
        floorCell.className = "ts-floor";
        floorCell.textContent = `${it.floorNum} эт.`;

        const roomCell = document.createElement("td");
        roomCell.className = "ts-room";
        roomCell.textContent = it.roomName;

        const groupCell = document.createElement("td");
        groupCell.className = "ts-group";
        groupCell.textContent = it.groupName ? `гр. ${it.groupName}` : "";

        row.append(slotCell, buildingCell, floorCell, roomCell, groupCell);

        const openScheduleItem = () => {
          // 1) проставить чётность / день / слот
          setScheduleControls({
            weekType: wtObj.value,
            day: day.value,
            slotId: it.slotId
          });

          // 2) выбрать корпус и этаж в верхних селектах
          pickBuildingAndFloor(it.buildingId, it.floorNum);

          // 3) подсветить аудиторию
          delayedHighlight(it.roomName);
        };

        row.addEventListener("click", openScheduleItem);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openScheduleItem();
          }
        });

        tbody.appendChild(row);
      }

      weekBox.appendChild(dayWrap);

      // если за это время дернули rebuild (сменили чётность) — выйти
      if (myVersion !== buildVersion) return;
    }

    if (!weekBox.children.length) {
      empty.style.display = "block";
    }

    frag.appendChild(weekSection);
    list.appendChild(frag);
  }

  async function buildGroupSchedule() {
    const myVersion = ++groupBuildVersion;

    const block = $("#group-schedule-block");
    const list  = $("#group-schedule-list");
    const empty = $("#group-schedule-empty");
    const title = block?.querySelector("h3");
    const groupSel = $("#group-schedule-select");
    if (!block || !list || !empty || !groupSel) return;

    await Promise.all([
      ensureGroupsLoaded(),
      ensureRoomsMetaLoaded(),
      ensureBuildingsLoaded(),
      ensureTeachersLoaded()
    ]);

    fillGroupScheduleSelect();
    block.hidden = false;
    list.innerHTML = "";
    empty.style.display = "none";

    const groupId = Number(groupSel.value || 0);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      if (title) title.textContent = "Расписание группы";
      empty.textContent = "Выберите группу";
      empty.style.display = "block";
      return;
    }

    const groupObj = GroupsCache.byId.get(groupId);
    const groupName = groupDisplayName(groupObj, groupId);
    const wtVal = currentWeekType();
    const wtObj = wtByValue.get(wtVal) || { value: wtVal, label: wtVal };
    if (title) {
      title.textContent = `Расписание группы ${groupName} — ${wtObj.label}`;
    }

    let slotMap = slotMapFromSelect();
    if (!slotMap.size) {
      slotMap = await loadSlotsFromApi();
    }
    if (!slotMap.size) {
      list.innerHTML = `<div class="muted">Слоты не найдены.</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    const weekSection = document.createElement("section");
    weekSection.className = "ts-weektype";
    weekSection.innerHTML = `<h4 style="margin-top:14px">${wtObj.label}</h4>`;
    const weekBox = document.createElement("div");
    weekBox.className = "ts-weekbox";
    weekSection.appendChild(weekBox);

    for (const day of DAYS) {
      const rows = [];

      for (const [slotId, slotInfo] of slotMap.entries()) {
        /* eslint-disable no-await-in-loop */
        const { data } = await fetchGroupBookings(groupId, day.value, wtObj.value, slotId);
        /* eslint-enable no-await-in-loop */

        for (const b of data) {
          const classroomPk = Number(b.classroomId);
          const rm = RoomsMeta.byId.get(classroomPk);
          if (!rm) continue;

          const floorNumRaw = (b.floor != null ? Number(b.floor) : rm.floor);
          const floorNum = Number.isFinite(floorNumRaw) ? floorNumRaw : 0;

          const buildingIdRaw = (b.buildingId != null ? Number(b.buildingId) : rm.buildingId);
          const buildingId = Number.isFinite(buildingIdRaw) ? buildingIdRaw : null;
          const buildingName = resolveBuildingName(buildingId, rm);

          const teacherId = Number(b.teacherId);
          const teacherObj = TeachersCache.byId.get?.(teacherId);

          rows.push({
            slotId,
            slotLabel: slotInfo.label,
            classroomId: classroomPk,
            buildingId,
            buildingName,
            floorNum,
            roomName: firstText(rm.name) || `Ауд. ${classroomPk}`,
            teacherName: Number.isFinite(teacherId) ? teacherDisplayName(teacherObj, teacherId) : ""
          });
        }
      }

      if (!rows.length) {
        continue;
      }

      rows.sort((a,b) =>
        (a.slotId - b.slotId) ||
        a.buildingName.localeCompare(b.buildingName, "ru") ||
        (a.floorNum - b.floorNum) ||
        a.roomName.localeCompare(b.roomName, "ru") ||
        a.teacherName.localeCompare(b.teacherName, "ru")
      );

      const dayWrap = document.createElement("div");
      dayWrap.className = "ts-day";
      dayWrap.innerHTML = `<h5 style="margin:8px 0 4px">${day.label}</h5>`;

      const tableWrap = document.createElement("div");
      tableWrap.className = "ts-table-wrap";

      const table = document.createElement("table");
      table.className = "ts-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Пара</th>
            <th>Корпус</th>
            <th>Этаж</th>
            <th>Аудитория</th>
            <th>Преподаватель</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");
      tableWrap.appendChild(table);
      dayWrap.appendChild(tableWrap);

      for (const it of rows) {
        const row = document.createElement("tr");
        row.className = "ts-item ts-table-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `${day.label}: ${it.slotLabel}, ${it.roomName}`);

        const slotCell = document.createElement("td");
        slotCell.className = "ts-slot";
        slotCell.textContent = it.slotLabel;

        const buildingCell = document.createElement("td");
        buildingCell.textContent = it.buildingName;

        const floorCell = document.createElement("td");
        floorCell.className = "ts-floor";
        floorCell.textContent = `${it.floorNum} эт.`;

        const roomCell = document.createElement("td");
        roomCell.className = "ts-room";
        roomCell.textContent = it.roomName;

        const teacherCell = document.createElement("td");
        teacherCell.className = "ts-group";
        teacherCell.textContent = it.teacherName || "—";

        row.append(slotCell, buildingCell, floorCell, roomCell, teacherCell);

        const openScheduleItem = () => {
          setScheduleControls({
            weekType: wtObj.value,
            day: day.value,
            slotId: it.slotId
          });
          pickBuildingAndFloor(it.buildingId, it.floorNum);
          delayedHighlight(it.roomName);
        };

        row.addEventListener("click", openScheduleItem);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openScheduleItem();
          }
        });

        tbody.appendChild(row);
      }

      weekBox.appendChild(dayWrap);

      if (myVersion !== groupBuildVersion) return;
    }

    if (!weekBox.children.length) {
      empty.textContent = "Занятий не найдено";
      empty.style.display = "block";
    }

    frag.appendChild(weekSection);
    list.appendChild(frag);
  }

  // =========================
  // init + подписки
  // =========================
  function rebuildSchedules() {
    buildFullSchedule();
    buildGroupSchedule();
  }

  function refreshSchedules() {
    bookingsCache.clear();
    rebuildSchedules();
  }

  function init() {
    rebuildSchedules();

    // если пользователь вручную меняет чётность недели или слот — перестраиваем
    $("#sch-weektype")?.addEventListener("change", rebuildSchedules);
    $("#slot-filter") ?.addEventListener("change", rebuildSchedules);
    $("#group-schedule-select")?.addEventListener("change", buildGroupSchedule);

    // если слоты подгружаются асинхронно в plan-page.js — ждём появления реальных options
    const slotSel = $("#slot-filter");
    if (slotSel) {
      const obs = new MutationObserver(() => {
        const ok = Array.from(slotSel.options).some(o => Number(o.value || 0) > 0);
        if (ok) {
          obs.disconnect();
          rebuildSchedules();
        }
      });
      obs.observe(slotSel, { childList: true });
    }
  }

  init();

  // наружу — чтобы можно было вручную пересобрать расписание
  window.buildTeacherScheduleFull = buildFullSchedule;
  window.buildGroupScheduleFull = buildGroupSchedule;
  window.refreshSchedules = refreshSchedules;
})();

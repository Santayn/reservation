// /app/teacher-schedule.js
// Моё полное расписание: берём только брони текущего пользователя (не-админа) через /api/bookings/my.
// Показываем ТОЛЬКО выбранный тип недели. Название группы берём из GroupsCache.

(function () {
  "use strict";
  if (window.__TS_INIT__) return;
  window.__TS_INIT__ = true;

  const $ = (s, r) => (r || document).querySelector(s);
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

  // общие кэши из plan-page.js
  const RoomsMeta   = window.RoomsMeta   || { byId:new Map(), byName:new Map(), loaded:false };
  const GroupsCache = window.GroupsCache || { byId:new Map(), loaded:false };

  // ===== slots =====
  function slotMapFromSelect() {
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
    try {
      const r = await fetch("/api/schedule/slots", { credentials:"include" });
      if (!r.ok) return new Map();
      const data = await r.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      const map = new Map();
      for (const s of arr) {
        const id = Number(s.id ?? s.slotId ?? s.slot_id);
        if (!id) continue;
        const start = s.startAt ?? s.start_at ?? s.start;
        const end   = s.endAt   ?? s.end_at   ?? s.end;
        const label = formatTime(start) + " – " + formatTime(end);
        map.set(id, { id, label });
      }
      return map;
    } catch { return new Map(); }
  }
  function formatTime(isoLike) {
    if (!isoLike) return "??:??";
    const d = new Date(String(isoLike).replace(" ", "T"));
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // ===== helpers =====
  function firstText(...vals){ for (const v of vals){ const s = v==null?"":String(v).trim(); if (s) return s; } return ""; }
  function groupDisplayName(groupObj, id){
    return firstText(groupObj?.name, groupObj?.title, groupObj?.groupName, groupObj?.shortName, groupObj?.code, groupObj?.number, groupObj?.label) || `Группа ${id}`;
  }
  function classroomIdFromRoom(roomName) {
    const m = String(roomName).match(/\d{3}/);
    if (m) return Number(m[0]);
    let hash = 1000;
    for (let i = 0; i < roomName.length; i++) hash = (hash * 31 + roomName.charCodeAt(i)) >>> 0;
    return hash;
  }
  function currentWeekType() {
    return $("#sch-weektype")?.value || window.SchedulePanel?.getSettings?.()?.weekParityType || "ANY";
  }
  function setScheduleControls({ weekType, day, slotId }) {
    const wt = $("#sch-weektype"), d = $("#sch-day"), sl = $("#slot-filter");
    if (wt) { wt.value = weekType; wt.dispatchEvent(new Event("change", { bubbles:true })); }
    if (d)  { d.value  = day;      d.dispatchEvent(new Event("change",  { bubbles:true })); }
    if (sl) { sl.value = String(slotId); sl.dispatchEvent(new Event("change", { bubbles:true })); }
  }
  function switchToFloor(targetFloor) {
    const btn = document.querySelector(`.floor-switch button[data-floor="${targetFloor}"]`);
    btn?.click();
  }
  function highlightRoom(roomName) {
    $all(".room").forEach(r => r.classList.remove("selected"));
    const btn = Array.from($all(".room")).find(b => (b.dataset.room || b.textContent.trim()) === roomName);
    if (btn) {
      btn.classList.add("selected");
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ===== агрегированный поиск (для текущего препода) =====
  // Ключ кэша: DAY|WEEK|SLOT
  const bookingsCache = new Map(); // -> Promise<Array<Booking>>
  function keyDW(day, week, slotId){ return `${day}|${week}|${slotId}`; }

  async function fetchMyBookings(dayOfWeek, weekParityType, slotId) {
    const k = keyDW(dayOfWeek, weekParityType, slotId);
    if (bookingsCache.has(k)) return bookingsCache.get(k);
    const params = new URLSearchParams({
      dayOfWeek, weekParityType, slotId:String(slotId)
      // slim не нужен для /api/bookings/my — отдаём полные записи
    });
    const p = fetch(`/api/bookings/my?${params.toString()}`, { credentials:"include" })
      .then(async r => {
        if (r.status === 401) {
          return { _error: "unauth", data: [] };
        }
        if (!r.ok) return { data: [] };
        return { data: await r.json() };
      })
      .catch(() => ({ data: [] }));
    bookingsCache.set(k, p);
    return p;
  }

  // ===== рендер =====
  let buildVersion = 0;

  async function buildFullSchedule() {
    const myVersion = ++buildVersion;

    const block = $("#teacher-schedule-block");
    const list  = $("#teacher-schedule-list");
    const empty = $("#teacher-schedule-empty");
    const title = block?.querySelector("h3");
    if (!block || !list || !empty) return;

    list.innerHTML = "";
    empty.style.display = "none";
    block.hidden = false;

    const wtVal = currentWeekType();
    const wt = wtByValue.get(wtVal) || { value: wtVal, label: wtVal };
    if (title) title.textContent = `Моё расписание — ${wt.label}`;

    let slotMap = slotMapFromSelect();
    if (!slotMap.size) slotMap = await loadSlotsFromApi();
    if (!slotMap.size) { list.innerHTML = `<div class="muted">Слоты не найдены.</div>`; return; }

    // индекс аудиторий: сначала из DOM, если нет — из RoomsMeta
    const roomIdx = new Map();
    for (const btn of $all(".room")) {
      if (btn.classList.contains("foyer")) continue;
      const roomName = btn.dataset.room || btn.textContent.trim();
      const classroomId = classroomIdFromRoom(roomName);
      const floor = Number(btn.closest(".floor")?.dataset.floor || RoomsMeta.byId.get(classroomId)?.floor || 0);
      const wing = btn.closest(".wing");
      const titleWing = wing?.querySelector("h3")?.textContent?.trim() || "";
      let corpus = "Корпус";
      if (/лев/i.test(titleWing)) corpus = "Левый корпус";
      else if (/прав/i.test(titleWing)) corpus = "Правый корпус";
      else if (/центр/i.test(titleWing)) corpus = "Центр";
      roomIdx.set(classroomId, { roomName, floor, corpus });
    }
    if (RoomsMeta.loaded && roomIdx.size === 0) {
      for (const [id, m] of RoomsMeta.byId.entries()) {
        roomIdx.set(Number(id), { roomName: m.name || String(id), floor: Number(m.floor||0), corpus: m.corpus || "Корпус" });
      }
    }

    const frag = document.createDocumentFragment();
    const sec = document.createElement("section");
    sec.className = "ts-weektype";
    sec.innerHTML = `<h4 style="margin-top:14px">${wt.label}</h4>`;
    const weekBox = document.createElement("div");
    weekBox.className = "ts-weekbox";
    sec.appendChild(weekBox);

    for (const day of DAYS) {
      const items = [];

      for (const [slotId, slot] of slotMap.entries()) {
        /* eslint-disable no-await-in-loop */
        const { _error, data } = await fetchMyBookings(day.value, wt.value, slotId);
        if (_error === "unauth") {
          list.innerHTML = `<div class="muted">Не авторизован. Войдите, чтобы увидеть своё расписание.</div>`;
          return;
        }
        /* eslint-enable no-await-in-loop */
        for (const b of data) {
          const meta = roomIdx.get(Number(b.classroomId));
          if (!meta) continue;

          // имя группы
          const gid = Number(b.groupId);
          const gObj = GroupsCache.byId.get?.(gid);
          const gName = groupDisplayName(gObj, gid);

          items.push({
            time: slot.label,
            slotId,
            corpus: meta.corpus,
            floor: meta.floor,
            roomName: meta.roomName,
            groupId: gid,
            groupName: gName
          });
        }
      }

      if (!items.length) continue;

      items.sort((a, b) =>
        (a.slotId - b.slotId) ||
        a.corpus.localeCompare(b.corpus, "ru") ||
        (a.floor - b.floor) ||
        a.roomName.localeCompare(b.roomName, "ru") ||
        a.groupName.localeCompare(b.groupName, "ru")
      );

      const dayWrap = document.createElement("div");
      dayWrap.className = "ts-day";
      dayWrap.innerHTML = `<h5 style="margin:8px 0 4px">${day.label}</h5>`;
      const dayList = document.createElement("div");
      dayList.className = "ts-day-list";
      dayWrap.appendChild(dayList);

      for (const it of items) {
        const row = document.createElement("div");
        row.className = "ts-item";
        row.style.padding = "2px 0";
        row.innerHTML =
          `<b>${it.time}</b> — ${it.corpus}, <b>${it.floor} эт.</b>, <b>${it.roomName}</b>` +
          (it.groupName ? ` &nbsp;<span class="muted">• гр. ${it.groupName}</span>` : "");
        row.addEventListener("click", () => {
          setScheduleControls({ weekType: wt.value, day: day.value, slotId: it.slotId });
          switchToFloor(it.floor);
          highlightRoom(it.roomName);
        });
        dayList.appendChild(row);
      }

      weekBox.appendChild(dayWrap);
      if (myVersion !== buildVersion) return; // отмена, если стартовал новый прогон
    }

    if (!weekBox.children.length) { empty.style.display = "block"; return; }
    frag.appendChild(sec);
    list.appendChild(frag);
  }

  function init() {
    // Начальная сборка
    buildFullSchedule();

    // Пересборка при смене чётности/слота
    $("#sch-weektype")?.addEventListener("change", () => buildFullSchedule());
    $("#slot-filter") ?.addEventListener("change", () => buildFullSchedule());

    // Пересборка, когда слоты подгрузятся динамически
    const sl = $("#slot-filter");
    if (sl) {
      const obs = new MutationObserver(() => {
        const hasRealOptions = Array.from(sl.options).some(o => Number(o.value || 0) > 0);
        if (hasRealOptions) { obs.disconnect(); buildFullSchedule(); }
      });
      obs.observe(sl, { childList: true });
    }
  }

  init();
  window.buildTeacherScheduleFull = buildFullSchedule;
})();

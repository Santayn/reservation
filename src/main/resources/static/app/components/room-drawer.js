// /app/components/room-drawer.js
// Панель справа ("drawer") для бронирования аудитории.
//
// ВАЖНО:
//  - Для СОЗДАНИЯ/ОБНОВЛЕНИЯ брони мы шлём classroomName (строка).
//    Бэк не принимает classroomId.
//  - Для чтения текущих броней и подсчёта занятости мы используем classroomDbId
//    (PK аудитории в БД). Это только для GET /api/bookings/search.
//
// Формат POST /api/bookings (BookingCreateRequest):
// {
//   "dayOfWeek": "FRIDAY",
//   "floor": 2,
//   "weekParityType": "ANY",
//   "slotId": 1,
//   "groupId": 1,
//   "teacherId": 2,
//   "classroomName": "Ауд. 101",
//   "date": "2025-10-31",
//   "timeZoneId": "UTC+03:00"
// }
//
// Тайм-зона: берём из #sch-tz. Если пусто — "UTC+03:00".

(function () {
  "use strict";

  const $  = (sel) => document.querySelector(sel);
  const el = (id)  => document.getElementById(id);

  // Глобальное состояние дровера
  const state = {
    open: false,
    current: null,          // { roomName, classroomDbId, capacity, floor, slot:{id,label}, dayOfWeek, weekParityType }
    lastBookings: [],       // slim-брони по текущей аудитории/слоту
    selectedTeacherId: null // выбранный преподаватель (обязателен)
  };

  // Кэши для вспомогательных данных
  const classroomIndex = { byName: new Map(), byId: new Map(), loaded: false };
  const groupsCache    = { list: [], byId: new Map() };
  const teachersCache  = { list: [], byId: new Map(), loaded: false };

  // ======================
  // helpers: http, utils
  // ======================

  async function apiGet(url) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return r.json();
  }

  async function apiPut(url, body) {
    const r = await fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      throw new Error((await r.text()) || `PUT ${url} -> ${r.status}`);
    }
    // PUT /api/classrooms/{id} может не возвращать тело -> не делаем r.json() безусловно
    try {
      return await r.json();
    } catch {
      return null;
    }
  }

  function firstText(...vals) {
    for (const v of vals) {
      const s = v == null ? "" : String(v).trim();
      if (s) return s;
    }
    return "";
  }

  function getSelectedDateStr() {
    // yyyy-MM-dd из поля ввода даты
    return document.querySelector("#date-input")?.value?.trim() || null;
  }

  // Тайм-зона из селекта. Если не выбрано — дефолт "UTC+03:00".
  function getSelectedTzId() {
    const raw = document.querySelector("#sch-tz")?.value?.trim();
    return raw || "UTC+03:00";
  }

  // ======================
  // аудитории (PK, метаданные)
  // ======================

  // грузим список аудиторий, чтобы иметь карту имя -> PK
  async function ensureClassroomsIndex() {
    if (classroomIndex.loaded) return;
    const data = await apiGet("/api/classrooms?size=1000").catch(() => []);
    const items = Array.isArray(data)
      ? data
      : (Array.isArray(data.content) ? data.content : []);
    for (const c of items) {
      const pk = Number(c.id);
      const nm = firstText(c.name);
      if (Number.isFinite(pk)) classroomIndex.byId.set(pk, pk); // просто отмечаем что pk существует
      if (nm) classroomIndex.byName.set(nm, pk);
    }
    classroomIndex.loaded = true;
  }

  // пытаемся получить PK аудитории для state.current:
  // - сначала берём current.classroomDbId (если пришёл из plan-page.js)
  // - иначе пробуем найти по имени аудитории через /api/classrooms?size=1000
  async function resolveClassroomPk(roomCtx) {
    const maybePk = Number(roomCtx.classroomDbId);
    if (Number.isFinite(maybePk)) {
      try {
        await apiGet(`/api/classrooms/${maybePk}`);
        return maybePk;
      } catch {
        // если даже прямой pk не проходит — попробуем по имени ниже
      }
    }

    await ensureClassroomsIndex();

    const name = firstText(roomCtx.roomName);
    if (name && classroomIndex.byName.has(name)) {
      return classroomIndex.byName.get(name);
    }

    throw new Error(
      `Не удалось определить PK аудитории для "${name || "?"}": ` +
      `нет classroomDbId и не нашли по имени`
    );
  }

  // ======================
  // открытие/закрытие дровера
  // ======================

  function openDrawer(roomCtx) {
    // roomCtx ожидается вида:
    // {
    //   roomName: "Ауд. 101",
    //   classroomDbId: 2,        // PK из БД (для GET поиска занятости)
    //   capacity: 30,
    //   floor: 2,
    //   slot: { id:1, label:"08:00 – 09:30" },
    //   dayOfWeek: "FRIDAY",
    //   weekParityType: "ANY"
    // }

    state.open = true;
    state.current = roomCtx;
    state.selectedTeacherId = null;
    state.lastBookings = [];

    // заполняем верхнюю часть панели
    el("d-room").textContent = firstText(roomCtx.roomName, "—");
    el("d-cap").textContent  = String(roomCtx.capacity ?? 0);
    el("d-slot").textContent = roomCtx.slot?.label || "—";
    el("d-by").textContent   = "—";

    // подготовка секций
    el("groups-box").innerHTML = "";
    ensureTeacherSelectUI();
    resetTeacherSelect();
    el("current-chips").innerHTML = "—";
    el("usage-line").textContent = `0 / ${roomCtx.capacity ?? 0}`;

    const capInput = el("c-cap");
    if (capInput) {
      capInput.value = String(roomCtx.capacity ?? 0);
      capInput.oninput = () => {
        const capNow = Number(capInput.value) || 0;
        updateUsage(state.lastBookings, capNow, groupsCache.byId);
      };
    }

    // сразу дёргаем данные: текущие брони, группы, преподаватели
    Promise.all([
      fetchCurrentBookings(roomCtx).catch(() => []),
      fetchGroups().catch(() => []),
      fetchTeachers().catch(() => [])
    ])
    .then(([bookings]) => {
      state.lastBookings = bookings;
      renderCurrentBookings(bookings, groupsCache.byId);
      renderGroups(groupsCache.list);
      fillTeacherSelect(teachersCache.list);
      updateUsage(
        bookings,
        roomCtx.capacity || 0,
        groupsCache.byId
      );
    })
    .catch(() => { /* молчим, панель всё равно открыта */ });

    // метаданные кабинета (корпус/факультет/спец)
    resolveClassroomPk(roomCtx)
      .then((pk) => hydrateRoomMeta(pk))
      .catch(() => { /* тихо, просто не заполним */ });

    // отключаем кнопку "Создать серию", пока серий нет
    const seriesBtn = el("save-series");
    if (seriesBtn) {
      seriesBtn.disabled = true;
      seriesBtn.title = "Серии отключены";
    }

    // показать панель
    $("#overlay").classList.add("open");
    $("#drawer").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    state.open = false;
    state.current = null;
    state.lastBookings = [];
    state.selectedTeacherId = null;

    $("#overlay").classList.remove("open");
    $("#drawer").classList.remove("open");
    $("#drawer").setAttribute("aria-hidden", "true");
  }

  // ======================
  // загрузка данных в панель
  // ======================

  async function fetchGroups() {
    try {
      const data = await apiGet("/api/groups?size=1000");
      const arr = Array.isArray(data)
        ? data
        : (Array.isArray(data.content) ? data.content : []);

      const mapped = arr.map((g) => {
        const id = Number(g.id);
        const displayName = firstText(
          g.name, g.title, g.groupName, g.shortName,
          g.code, g.number, g.label
        ) || `Группа ${id}`;
        return {
          id,
          displayName,
          personsCount: Number(g.personsCount) || 0
        };
      });

      groupsCache.list = mapped;
      groupsCache.byId = new Map(mapped.map((g) => [g.id, g]));

      return mapped;
    } catch {
      return [];
    }
  }

  async function fetchTeachers() {
    if (teachersCache.loaded && teachersCache.list.length) {
      return teachersCache.list;
    }
    try {
      const data = await apiGet("/api/teachers?size=1000");
      const arr = Array.isArray(data)
        ? data
        : (Array.isArray(data.content) ? data.content : []);

      const mapped = arr
        .map((t) => {
          const id = Number(t.id);
          const fullName = firstText(t.fullName, t.name) || `Преподаватель ${id}`;
          const login    = firstText(t.login, t.username, t.userLogin, t.user?.login) || "—";
          return { id, fullName, login };
        })
        .filter((t) => Number.isFinite(t.id));

      teachersCache.list   = mapped;
      teachersCache.byId   = new Map(mapped.map((t) => [t.id, t]));
      teachersCache.loaded = true;
      return mapped;
    } catch {
      return [];
    }
  }

  // Получить slim-брони для текущей аудитории/слота/дня.
  // Для этого нужен PK аудитории (classroomDbId или вычисленный).
  async function fetchCurrentBookings(ctx) {
    // 1) нужно определить PK аудитории
    const classroomPk = await resolveClassroomPk(ctx);

    // 2) собираем параметры
    const params = new URLSearchParams({
      classroomId:   String(classroomPk),
      dayOfWeek:     ctx.dayOfWeek || "",
      weekParityType: ctx.weekParityType || "ANY",
      slotId:        String(ctx.slot?.id || 0),
      slim:          "true"
    });

    const r = await fetch(`/api/bookings/search?${params.toString()}`, {
      credentials: "include"
    });
    if (!r.ok) return [];
    return r.json();
  }

  // ======================
  // создание / удаление брони
  // ======================

  async function saveBooking(selectedGroupId) {
    if (!state.current) {
      throw new Error("Нет выбранной аудитории.");
    }
    if (!Number.isFinite(state.selectedTeacherId)) {
      alert("Выберите преподавателя.");
      throw new Error("Преподаватель не выбран.");
    }

    const ctx = state.current;

    // Проверим обязательные поля
    const dateStr = getSelectedDateStr();
    if (!dateStr) {
      alert("Не выбрана дата.");
      throw new Error("date is null");
    }
    if (!ctx.dayOfWeek) {
      alert("Не выбран день недели.");
      throw new Error("dayOfWeek is null");
    }
    if (!ctx.slot || !Number.isFinite(ctx.slot.id)) {
      alert("Не выбран слот.");
      throw new Error("slotId is invalid");
    }
    if (!ctx.roomName) {
      alert("Не выбрана аудитория (classroomName).");
      throw new Error("classroomName is null");
    }

    // Формируем тело POST /api/bookings
    const body = {
      dayOfWeek:      ctx.dayOfWeek,
      floor:          ctx.floor,
      weekParityType: ctx.weekParityType,
      slotId:         ctx.slot.id,
      groupId:        selectedGroupId,
      teacherId:      state.selectedTeacherId,
      classroomName:  ctx.roomName,        // ВАЖНО: строка имени аудитории
      date:           dateStr,             // yyyy-MM-dd
      timeZoneId:     getSelectedTzId()    // "UTC+03:00" и т.п.
    };

    const r = await fetch("/api/bookings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      throw new Error((await r.text()) || `Ошибка сохранения (${r.status})`);
    }

    return r.json();
  }

  // Удалить ВСЕ найденные брони в этой ячейке (слот+комната+день)
  async function deleteExistingBooking() {
    if (!state.current) {
      throw new Error("Нет выбранной аудитории.");
    }
    const list = await fetchCurrentBookings(state.current);
    if (!list.length) {
      throw new Error("Нет текущих бронирований для удаления.");
    }

    for (const b of list) {
      const r = await fetch(`/api/bookings/${b.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!r.ok) {
        throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
      }
    }
  }

  // Удалить бронь конкретной группы в этой ячейке
  async function deleteBookingForGroup(groupId) {
    if (!state.current) {
      throw new Error("Нет выбранной аудитории.");
    }
    const list = await fetchCurrentBookings(state.current);
    const victim = list.find((b) => Number(b.groupId) === Number(groupId));
    if (!victim) {
      throw new Error("Бронирование этой группы не найдено.");
    }

    const r = await fetch(`/api/bookings/${victim.id}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (!r.ok) {
      throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
    }
  }

  // ======================
  // рендеринг панели
  // ======================

  function renderCurrentBookings(bookings, groupsById) {
    const box       = el("d-by");
    const chipsWrap = el("current-chips");

    if (!bookings || !bookings.length) {
      if (box)       box.textContent      = "—";
      if (chipsWrap) chipsWrap.innerHTML  = "—";
      return;
    }

    const names = [];
    if (chipsWrap) chipsWrap.innerHTML = "";

    for (const b of bookings) {
      const gid  = Number(b.groupId);
      const g    = groupsById.get?.(gid);
      const name = g?.displayName ?? String(gid);
      const pcs  = Number(g?.personsCount ?? 0);
      names.push(name);

      if (chipsWrap) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.title = "Удалить группу из бронирования";
        btn.dataset.groupId = String(gid);
        btn.innerHTML = `<b>${name}</b> <span>(${pcs} чел.)</span>`;
        btn.addEventListener("click", async () => {
          try {
            await deleteBookingForGroup(gid);
            const fresh = await fetchCurrentBookings(state.current);
            state.lastBookings = fresh;
            renderCurrentBookings(fresh, groupsCache.byId);
            updateUsage(
              fresh,
              Number(el("c-cap").value) || (state.current?.capacity || 0),
              groupsCache.byId
            );
            window.planRefreshOccupancy?.();
          } catch (e) {
            alert(e.message || "Не удалось удалить группу.");
          }
        });
        chipsWrap.appendChild(btn);
      }
    }

    if (box) {
      box.textContent = `Группы: ${names.join(", ")}`;
    }
  }

  function renderGroups(groups) {
    const box = el("groups-box");
    if (!box) return;

    box.innerHTML = "";

    for (const g of groups) {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "sel-group";
      input.value = String(g.id);
      label.appendChild(input);

      const span = document.createElement("span");
      span.textContent = `${g.displayName} (id=${g.id}, ${g.personsCount} чел.)`;
      label.appendChild(span);

      box.appendChild(label);
    }
  }

  // ======================
  // преподаватели
  // ======================

  function ensureTeacherSelectUI() {
    // если блок уже есть — не дублируем
    if (el("teacher-section")) return;

    // найдём контейнер, куда вставить
    // пробуем найти элемент .drawer-content (если есть разметка),
    // иначе fallback на сам #drawer
    const drawerContent =
      $("#drawer .drawer-content") ||
      $("#drawer .content") ||
      $("#drawer");

    const section = document.createElement("section");
    section.id = "teacher-section";
    section.style.margin = "12px 0";
    section.style.borderTop = "1px solid #e5e5e5";
    section.style.paddingTop = "10px";

    section.innerHTML = `
      <label for="teacher-select"
             style="font-weight:600; display:block; margin-bottom:6px;">
        Преподаватель (обязательно)
      </label>
      <select id="teacher-select"
              style="width:100%; max-width:420px; padding:6px 8px;">
        <option value="">—</option>
      </select>
    `;

    // Вставим перед списком групп, если он существует
    const groupsBox = el("groups-box");
    if (groupsBox?.parentElement) {
      groupsBox.parentElement.insertBefore(section, groupsBox);
    } else {
      drawerContent?.appendChild(section);
    }

    const sel = el("teacher-select");
    if (sel && !sel._bound) {
      sel.addEventListener("change", () => {
        const v = sel.value.trim();
        state.selectedTeacherId = v ? Number(v) : null;
      });
      sel._bound = true;
    }
  }

  function resetTeacherSelect() {
    const sel = el("teacher-select");
    if (sel) {
      sel.value = "";
      state.selectedTeacherId = null;
    }
  }

  function fillTeacherSelect(list) {
    const sel = el("teacher-select");
    if (!sel) return;

    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "—";
    sel.appendChild(opt0);

    for (const t of list) {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = `${t.login} — ${t.fullName} (id=${t.id})`;
      sel.appendChild(opt);
    }

    sel.value = "";
    state.selectedTeacherId = null;
  }

  // ======================
  // метаданные кабинета (вместимость, корпус, ...)
  // ======================

  async function hydrateRoomMeta(classroomPk) {
    // подгружаем возможные значения для селектов (корпуса, факультеты, спецы)
    const [buildings, faculties, specs] = await Promise.all([
      loadBuildings().catch(() => []),
      loadFaculties().catch(() => []),
      loadSpecs().catch(() => [])
    ]);

    fillSelect(
      el("c-building"),
      buildings.map((b) => ({ value: String(b.id), label: b.name })),
      true
    );
    fillSelect(
      el("c-faculty"),
      faculties.map((f) => ({ value: String(f.id), label: f.name })),
      true
    );
    fillSelect(
      el("c-spec"),
      specs.map((s) => ({ value: String(s.id), label: s.name })),
      true
    );

    // теперь конкретные данные этой аудитории
    try {
      const data = await apiGet(`/api/classrooms/${classroomPk}`);
      if (data.capacity != null && el("c-cap")) {
        el("c-cap").value = String(data.capacity);
      }
      if (data.buildingId != null && el("c-building")) {
        el("c-building").value = String(data.buildingId);
      }
      if (Array.isArray(data.facultyIds) && data.facultyIds[0] != null && el("c-faculty")) {
        el("c-faculty").value = String(data.facultyIds[0]);
      }
      if (Array.isArray(data.specializationIds) && data.specializationIds[0] != null && el("c-spec")) {
        el("c-spec").value = String(data.specializationIds[0]);
      }
    } catch {
      // аудитория могла не найтись или не отдать все поля — не страшно
    }
  }

  async function loadBuildings() {
    const data = await apiGet("/api/buildings?size=1000");
    const arr = Array.isArray(data)
      ? data
      : (Array.isArray(data.content) ? data.content : []);
    return arr.map((b) => ({
      id: b.id,
      name: b.name || b.title || `Корпус ${b.id}`
    }));
  }

  async function loadFaculties() {
    const data = await apiGet("/api/faculties?size=1000");
    const arr = Array.isArray(data)
      ? data
      : (Array.isArray(data.content) ? data.content : []);
    return arr.map((f) => ({
      id: f.id,
      name: f.name || f.title || `Факультет ${f.id}`
    }));
  }

  async function loadSpecs() {
    const data = await apiGet("/api/specializations?size=1000");
    const arr = Array.isArray(data)
      ? data
      : (Array.isArray(data.content) ? data.content : []);
    return arr.map((s) => ({
      id: s.id,
      name: s.name || s.title || `Специализация ${s.id}`
    }));
  }

  // ======================
  // расчёт загрузки аудитории
  // ======================

  function updateUsage(bookings, capacity, groupsById) {
    const totalPersons = (Array.isArray(bookings) ? bookings : [])
      .reduce((acc, b) => {
        const pc = groupsById.get?.(Number(b.groupId))?.personsCount;
        return acc + (Number.isFinite(pc) ? pc : 0);
      }, 0);

    const usageEl = el("usage-line");
    if (!usageEl) return;

    usageEl.textContent = `${totalPersons} / ${capacity}`;

    const ratio = capacity > 0 ? totalPersons / capacity : 0;
    let color = "";
    if (ratio > 1.0) {
      color = "#d32f2f";     // перегруз
    } else if (ratio >= 0.8) {
      color = "#ed6c02";     // почти полный
    } else {
      color = "#2e7d32";     // ок
    }
    usageEl.style.color = color;
  }

  function fillSelect(select, items, withEmpty) {
    if (!select) return;
    select.innerHTML = "";

    if (withEmpty) {
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "—";
      select.appendChild(opt0);
    }

    for (const it of items) {
      const opt = document.createElement("option");
      opt.value = String(it.value ?? it.id);
      opt.textContent = it.label ?? it.name ?? String(it.value ?? it.id);
      select.appendChild(opt);
    }
  }

  // ======================
  // кнопки дровера
  // ======================

  (function bindButtons() {
    el("d-close")?.addEventListener("click", closeDrawer);
    el("overlay")?.addEventListener("click", closeDrawer);

    el("save-book")?.addEventListener("click", async () => {
      try {
        // выбрали группу (radio)
        const selectedGroupRadio = document.querySelector('input[name="sel-group"]:checked');
        if (!selectedGroupRadio) {
          alert("Выберите группу.");
          return;
        }
        if (!Number.isFinite(state.selectedTeacherId)) {
          alert("Выберите преподавателя.");
          return;
        }

        await saveBooking(Number(selectedGroupRadio.value));

        // после сохранения — перезагружаем текущие брони,
        // пересчитываем usage, перекрашиваем план
        const bookings = await fetchCurrentBookings(state.current);
        state.lastBookings = bookings;

        renderCurrentBookings(bookings, groupsCache.byId);
        updateUsage(
          bookings,
          Number(el("c-cap").value) || (state.current?.capacity || 0),
          groupsCache.byId
        );

        window.planRefreshOccupancy?.();
        alert("Бронирование сохранено.");
      } catch (e) {
        alert(e.message || "Не удалось сохранить бронирование.");
      }
    });

    el("clear-book")?.addEventListener("click", async () => {
      try {
        await deleteExistingBooking();

        const bookings = await fetchCurrentBookings(state.current);
        state.lastBookings = bookings;

        renderCurrentBookings(bookings, groupsCache.byId);
        updateUsage(
          bookings,
          Number(el("c-cap").value) || (state.current?.capacity || 0),
          groupsCache.byId
        );

        window.planRefreshOccupancy?.();
        alert("Бронирование снято.");
      } catch (e) {
        alert(e.message || "Не удалось снять бронирование.");
      }
    });

    el("save-room-meta")?.addEventListener("click", async () => {
      try {
        if (!state.current) throw new Error("Кабинет не выбран.");
        const classroomPk = await resolveClassroomPk(state.current);

        const capVal = Number(el("c-cap")?.value);
        const bVal   = el("c-building")?.value?.trim();
        const fVal   = el("c-faculty")?.value?.trim();
        const sVal   = el("c-spec")?.value?.trim();

        const body = {
          capacity: Number.isFinite(capVal) ? capVal : 0,
          buildingId: bVal ? Number(bVal) : null,
          facultyIds: fVal ? [Number(fVal)] : [],
          specializationIds: sVal ? [Number(sVal)] : []
        };

        await apiPut(`/api/classrooms/${classroomPk}`, body);

        alert("Свойства кабинета сохранены.");

        updateUsage(
          state.lastBookings,
          Number(el("c-cap").value) || 0,
          groupsCache.byId
        );
      } catch (e) {
        alert(e.message || "Не удалось сохранить кабинет.");
      }
    });
  })();

  // экспортируем API наружу, чтобы plan-page.js мог вызвать Drawer.open(...)
  window.RoomDrawer = {
    open: openDrawer,
    close: closeDrawer
  };
})();

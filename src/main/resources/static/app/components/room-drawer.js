// room-drawer.js
// Используем slotId из селекта, никаких локальных слотов.
// Чипы текущих групп кликабельны — удаляют именно свою бронь.
// Обновлено:
//  - корректное имя группы (displayName из нескольких возможных полей)
//  - в списке преподавателей показывается login — Full Name (id=...)

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = (id) => document.getElementById(id);

  const state = {
    open: false,
    current: null,
    lastBookings: [],
    selectedTeacherId: null
  };

  // Кэш справочника аудиторий (по name -> id и id -> id)
  const classroomIndex = { byName: new Map(), byId: new Map(), loaded: false };

  // Кэши
  const groupsCache   = { list: [], byId: new Map() };
  const teachersCache = { list: [], byId: new Map(), loaded: false };

  // --------------------- helpers ---------------------
  async function apiGet(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return r.json();
  }
  async function apiPut(url, body) {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.text()) || `PUT ${url} -> ${r.status}`);
    return r.json?.() ?? null;
  }

  function firstText(...vals) {
    for (const v of vals) {
      const s = v == null ? "" : String(v).trim();
      if (s) return s;
    }
    return "";
  }

  async function ensureClassroomsIndex() {
    if (classroomIndex.loaded) return;
    const data = await apiGet("/api/classrooms?size=1000").catch(() => []);
    const items = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    for (const c of items) {
      const pk = Number(c.id);
      const nm = firstText(c.name);
      if (Number.isFinite(pk)) classroomIndex.byId.set(pk, pk);
      if (nm) classroomIndex.byName.set(nm, pk);
    }
    classroomIndex.loaded = true;
  }
  async function resolveClassroomPk(roomCtx) {
    const maybePk = Number(roomCtx.classroomId);
    if (Number.isFinite(maybePk)) {
      try { await apiGet(`/api/classrooms/${maybePk}`); return maybePk; } catch {}
    }
    await ensureClassroomsIndex();
    const name = firstText(roomCtx.roomName);
    if (name && classroomIndex.byName.has(name)) return classroomIndex.byName.get(name);
    const idAsName = firstText(roomCtx.classroomId);
    if (idAsName && classroomIndex.byName.has(idAsName)) return classroomIndex.byName.get(idAsName);
    throw new Error(`Не удалось определить PK аудитории для "${name || idAsName || "?"}"`);
  }

  // --------------------- drawer ---------------------
  function openDrawer(roomCtx) {
    state.open = true;
    state.current = roomCtx;
    state.selectedTeacherId = null;

    el("d-room").textContent = roomCtx.roomName;
    el("d-cap").textContent = String(roomCtx.capacity ?? 0);
    el("d-slot").textContent = roomCtx.slot?.label || "—";
    el("d-by").textContent = "—";

    // очистка UI
    el("groups-box").innerHTML = "";
    ensureTeacherSelectUI();         // создаём блок с <select>
    resetTeacherSelect();            // очищаем значение
    el("current-chips").innerHTML = "—";
    el("usage-line").textContent = `0 / ${roomCtx.capacity ?? 0}`;

    const capInput = el("c-cap");
    if (capInput) {
      capInput.value = String(roomCtx.capacity ?? 0);
      capInput.oninput = () => {
        const cap = Number(capInput.value) || 0;
        updateUsage(state.lastBookings, cap, groupsCache.byId);
      };
    }

    // грузим текущие брони + справочники
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
      updateUsage(bookings, roomCtx.capacity || 0, groupsCache.byId);
    })
    .catch(() => {});

    resolveClassroomPk(roomCtx).then((pk) => hydrateRoomMeta(pk)).catch(() => {});

    const seriesBtn = el("save-series");
    if (seriesBtn) { seriesBtn.disabled = true; seriesBtn.title = "Серии отключены"; }

    $("#overlay").classList.add("open");
    $("#drawer").classList.add("open");
    $("#drawer").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    state.open = false;
    state.current = null;
    $("#overlay").classList.remove("open");
    $("#drawer").classList.remove("open");
    $("#drawer").setAttribute("aria-hidden", "true");
  }

  // --------------------- data loads ---------------------
  async function fetchGroups() {
    try {
      const data = await apiGet("/api/groups?size=1000");
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      const mapped = arr.map((g) => {
        const id = Number(g.id);
        // Нормализованное имя группы
        const displayName = firstText(
          g.name, g.title, g.groupName, g.shortName, g.code, g.number, g.label
        ) || `Группа ${id}`;
      return {
          id,
          displayName,
          personsCount: Number(g.personsCount) || 0,
        };
      });
      groupsCache.list = mapped;
      groupsCache.byId = new Map(mapped.map((g) => [g.id, g]));
      return mapped;
    } catch { return []; }
  }

  async function fetchTeachers() {
    if (teachersCache.loaded && teachersCache.list.length) return teachersCache.list;
    try {
      const data = await apiGet("/api/teachers?size=1000");
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      const mapped = arr.map(t => {
        const id = Number(t.id);
        const fullName = firstText(t.fullName, t.name) || `Преподаватель ${id}`;
        const login = firstText(t.login, t.username, t.userLogin, t.user?.login) || "—";
        return { id, fullName, login };
      }).filter(t => Number.isFinite(t.id));
      teachersCache.list = mapped;
      teachersCache.byId = new Map(mapped.map(t => [t.id, t]));
      teachersCache.loaded = true;
      return mapped;
    } catch { return []; }
  }

  async function fetchCurrentBookings(ctx) {
    const params = new URLSearchParams({
      classroomId: String(ctx.classroomId),
      dayOfWeek: ctx.dayOfWeek || "",
      weekParityType: ctx.weekParityType || "ANY",
      slotId: String(ctx.slot?.id || 0),
    });
    const r = await fetch(`/api/bookings/search?${params.toString()}`);
    if (!r.ok) return [];
    return r.json();
  }

  // --------------------- save / delete ---------------------
  async function saveBooking(selectedGroupId) {
    if (!state.current) return;
    if (!Number.isFinite(state.selectedTeacherId)) {
      alert("Выберите преподавателя.");
      throw new Error("Преподаватель не выбран");
    }

    const ctx = state.current;
    const body = {
      dayOfWeek: ctx.dayOfWeek,
      floor: ctx.floor,
      weekParityType: ctx.weekParityType,
      slotId: ctx.slot?.id || 0,
      classroomId: ctx.classroomId,
      groupId: selectedGroupId,
      teacherId: state.selectedTeacherId   // <— обязательное поле
    };
    const r = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка сохранения (${r.status})`);
    return r.json();
  }

  async function deleteExistingBooking() {
    if (!state.current) return;
    const list = await fetchCurrentBookings(state.current);
    if (!list.length) throw new Error("Нет текущих бронирований для удаления.");
    for (const b of list) {
      const r = await fetch(`/api/bookings/${b.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
    }
  }

  async function deleteBookingForGroup(groupId) {
    if (!state.current) return;
    const list = await fetchCurrentBookings(state.current);
    const victim = list.find(b => Number(b.groupId) === Number(groupId));
    if (!victim) throw new Error("Бронирование этой группы не найдено.");
    const r = await fetch(`/api/bookings/${victim.id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
  }

  // --------------------- render ---------------------
  function renderCurrentBookings(bookings, groupsById) {
    const box = el("d-by");
    const chipsWrap = el("current-chips");

    if (!bookings || !bookings.length) {
      box.textContent = "—";
      chipsWrap.innerHTML = "—";
      return;
    }

    const names = [];
    chipsWrap.innerHTML = "";
    for (const b of bookings) {
      const gid = Number(b.groupId);
      const g = groupsById.get?.(gid);
      const name = g?.displayName ?? String(gid);
      const pcs  = Number(g?.personsCount ?? 0);
      names.push(name);

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
          updateUsage(fresh, Number(el("c-cap").value) || (state.current?.capacity || 0), groupsCache.byId);
          window.planRefreshOccupancy?.();
        } catch (e) {
          alert(e.message || "Не удалось удалить группу.");
        }
      });
      chipsWrap.appendChild(btn);
    }

    box.textContent = `Группы: ${names.join(", ")}`;
  }

  function renderGroups(groups) {
    const box = el("groups-box");
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

  // --- Преподаватели: выпадающий список (логин — ФИО) ---
  function ensureTeacherSelectUI() {
    if (el("teacher-section")) return;
    const drawer = $("#drawer .drawer-content") || $("#drawer");

    const section = document.createElement("section");
    section.id = "teacher-section";
    section.style.margin = "12px 0";
    section.style.borderTop = "1px solid #e5e5e5";
    section.style.paddingTop = "10px";

    section.innerHTML = `
      <label for="teacher-select" style="font-weight:600; display:block; margin-bottom:6px;">
        Преподаватель (обязательно)
      </label>
      <select id="teacher-select" style="width:100%; max-width:420px; padding:6px 8px;">
        <option value="">—</option>
      </select>
    `;

    // Вставим ПЕРЕД списком групп, если он есть
    const groupsBox = el("groups-box");
    if (groupsBox?.parentElement) {
      groupsBox.parentElement.insertBefore(section, groupsBox);
    } else {
      drawer?.appendChild(section);
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
    // очистить, добавить "—"
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "—";
    sel.appendChild(opt0);

    for (const t of list) {
      const text = `${t.login} — ${t.fullName} (id=${t.id})`;
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = text;
      sel.appendChild(opt);
    }
    sel.value = "";
    state.selectedTeacherId = null;
  }

  // --------------------- room meta ---------------------
  async function hydrateRoomMeta(classroomPk) {
    const [buildings, faculties, specs] = await Promise.all([
      loadBuildings().catch(() => []),
      loadFaculties().catch(() => []),
      loadSpecs().catch(() => []),
    ]);
    fillSelect(el("c-building"), buildings.map((b) => ({ value: String(b.id), label: b.name })), true);
    fillSelect(el("c-faculty"), faculties.map((f) => ({ value: String(f.id), label: f.name })), true);
    fillSelect(el("c-spec"), specs.map((s) => ({ value: String(s.id), label: s.name })), true);

    try {
      const data = await apiGet(`/api/classrooms/${classroomPk}`);
      if (data.capacity != null) el("c-cap").value = String(data.capacity);
      if (data.buildingId != null) el("c-building").value = String(data.buildingId);
      if (Array.isArray(data.facultyIds) && data.facultyIds[0] != null) el("c-faculty").value = String(data.facultyIds[0]);
      if (Array.isArray(data.specializationIds) && data.specializationIds[0] != null) el("c-spec").value = String(data.specializationIds[0]);
    } catch {}
  }

  async function loadBuildings() {
    const data = await apiGet("/api/buildings?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map((b) => ({ id: b.id, name: b.name || b.title || `Корпус ${b.id}` }));
  }
  async function loadFaculties() {
    const data = await apiGet("/api/faculties?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map((f) => ({ id: f.id, name: f.name || f.title || `Факультет ${f.id}` }));
  }
  async function loadSpecs() {
    const data = await apiGet("/api/specializations?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map((s) => ({ id: s.id, name: s.name || s.title || `Специализация ${s.id}` }));
  }

  // --------------------- usage ---------------------
  function updateUsage(bookings, capacity, groupsById) {
    const totalPersons = (Array.isArray(bookings) ? bookings : []).reduce((acc, b) => {
      const pc = groupsById.get?.(Number(b.groupId))?.personsCount;
      return acc + (Number.isFinite(pc) ? pc : 0);
    }, 0);

    const usageEl = el("usage-line");
    usageEl.textContent = `${totalPersons} / ${capacity}`;

    const ratio = capacity > 0 ? totalPersons / capacity : 0;
    let color = "";
    if (ratio > 1) color = "#d32f2f";
    else if (ratio >= 0.8) color = "#ed6c02";
    else color = "#2e7d32";
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

  // --------------------- buttons ---------------------
  (function bindButtons() {
    el("d-close")?.addEventListener("click", closeDrawer);
    el("overlay")?.addEventListener("click", closeDrawer);

    el("save-book")?.addEventListener("click", async () => {
      try {
        const selectedGroup = document.querySelector('input[name="sel-group"]:checked');
        if (!selectedGroup) { alert("Выберите группу."); return; }
        if (!Number.isFinite(state.selectedTeacherId)) { alert("Выберите преподавателя."); return; }
        await saveBooking(Number(selectedGroup.value));
        const bookings = await fetchCurrentBookings(state.current);
        state.lastBookings = bookings;
        renderCurrentBookings(bookings, groupsCache.byId);
        updateUsage(bookings, Number(el("c-cap").value) || (state.current?.capacity || 0), groupsCache.byId);
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
        updateUsage(bookings, Number(el("c-cap").value) || (state.current?.capacity || 0), groupsCache.byId);
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

        const capVal = Number(el("c-cap").value);
        const bVal = el("c-building").value?.trim();
        const fVal = el("c-faculty").value?.trim();
        const sVal = el("c-spec").value?.trim();

        const body = {
          capacity: Number.isFinite(capVal) ? capVal : 0,
          buildingId: bVal ? Number(bVal) : null,
          facultyIds: fVal ? [Number(fVal)] : [],
          specializationIds: sVal ? [Number(sVal)] : [],
        };

        await apiPut(`/api/classrooms/${classroomPk}`, body);
        alert("Свойства кабинета сохранены.");
        updateUsage(state.lastBookings, Number(el("c-cap").value) || 0, groupsCache.byId);
      } catch (e) {
        alert(e.message || "Не удалось сохранить кабинет.");
      }
    });
  })();

  // --------------------- export ---------------------
  window.RoomDrawer = { open: openDrawer, close: closeDrawer };
})();

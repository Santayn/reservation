// room-drawer.js
// Используем slotId из селекта, никаких локальных слотов.
// Чипы текущих групп кликабельны — удаляют именно свою бронь.

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = (id) => document.getElementById(id);

  const state = { open: false, current: null, lastBookings: [] };

  // Кэш справочника аудиторий (по name -> id и id -> id)
  const classroomIndex = { byName: new Map(), byId: new Map(), loaded: false };

  // Кэш групп
  const groupsCache = { list: [], byId: new Map() };

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

  async function ensureClassroomsIndex() {
    if (classroomIndex.loaded) return;
    const data = await apiGet("/api/classrooms?size=1000").catch(() => []);
    const items = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    for (const c of items) {
      const pk = Number(c.id);
      const nm = (c.name ?? "").toString().trim();
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
    const name = (roomCtx.roomName ?? "").toString().trim();
    if (name && classroomIndex.byName.has(name)) return classroomIndex.byName.get(name);
    const idAsName = (roomCtx.classroomId ?? "").toString().trim();
    if (idAsName && classroomIndex.byName.has(idAsName)) return classroomIndex.byName.get(idAsName);
    throw new Error(`Не удалось определить PK аудитории для "${name || idAsName || "?"}"`);
  }

  function openDrawer(roomCtx) {
    state.open = true;
    state.current = roomCtx;

    el("d-room").textContent = roomCtx.roomName;
    el("d-cap").textContent = String(roomCtx.capacity ?? 0);
    el("d-slot").textContent = roomCtx.slot?.label || "—";
    el("d-by").textContent = "—";

    el("groups-box").innerHTML = "";
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

    Promise.all([fetchCurrentBookings(roomCtx).catch(() => []), fetchGroups().catch(() => [])])
      .then(([bookings, groups]) => {
        state.lastBookings = bookings;
        renderCurrentBookings(bookings, groupsCache.byId);
        renderGroups(groups);
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

  async function fetchGroups() {
    try {
      const data = await apiGet("/api/groups?size=1000");
      const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
      const mapped = arr.map((g) => ({
        id: g.id,
        name: g.name || g.title || `Группа ${g.id}`,
        personsCount: Number(g.personsCount) || 0,
      }));
      groupsCache.list = mapped;
      groupsCache.byId = new Map(mapped.map((g) => [Number(g.id), g]));
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

  async function saveBooking(selectedGroupId) {
    if (!state.current) return;
    const ctx = state.current;
    const body = {
      dayOfWeek: ctx.dayOfWeek,
      floor: ctx.floor,
      weekParityType: ctx.weekParityType,
      slotId: ctx.slot?.id || 0,
      classroomId: ctx.classroomId,
      groupId: selectedGroupId,
    };
    const r = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка сохранения (${r.status})`);
    return r.json();
  }

  // Удалить все брони в текущем слоте/аудитории
  async function deleteExistingBooking() {
    if (!state.current) return;
    const list = await fetchCurrentBookings(state.current);
    if (!list.length) throw new Error("Нет текущих бронирований для удаления.");
    for (const b of list) {
      const r = await fetch(`/api/bookings/${b.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
    }
  }

  // Удалить бронь конкретной группы
  async function deleteBookingForGroup(groupId) {
    if (!state.current) return;
    const list = await fetchCurrentBookings(state.current);
    const victim = list.find(b => Number(b.groupId) === Number(groupId));
    if (!victim) throw new Error("Бронирование этой группы не найдено.");
    const r = await fetch(`/api/bookings/${victim.id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
  }

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

  // Текущие брони: чипы кликабельны — удаляют именно эту группу
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
      const name = g?.name ?? String(gid);
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

  // Справочник групп — с количеством людей
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
      span.textContent = `${g.name} (id=${g.id}, ${g.personsCount} чел.)`;
      label.appendChild(span);
      box.appendChild(label);
    }
  }

  // Суммарная загрузка по людям и цвет цифры
  function updateUsage(bookings, capacity, groupsById) {
    const totalPersons = (Array.isArray(bookings) ? bookings : []).reduce((acc, b) => {
      const pc = groupsById.get?.(Number(b.groupId))?.personsCount;
      return acc + (Number.isFinite(pc) ? pc : 0);
    }, 0);

    const usageEl = el("usage-line");
    usageEl.textContent = `${totalPersons} / ${capacity}`;

    // цвет (зелёный/оранжевый/красный)
    const ratio = capacity > 0 ? totalPersons / capacity : 0;
    let color = "";
    if (ratio > 1) color = "#d32f2f";           // красный
    else if (ratio >= 0.8) color = "#ed6c02";   // оранжевый
    else color = "#2e7d32";                     // зелёный
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

  (function bindButtons() {
    el("d-close")?.addEventListener("click", closeDrawer);
    el("overlay")?.addEventListener("click", closeDrawer);

    el("save-book")?.addEventListener("click", async () => {
      try {
        const selected = document.querySelector('input[name="sel-group"]:checked');
        if (!selected) { alert("Выберите группу."); return; }
        await saveBooking(Number(selected.value));
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

  window.RoomDrawer = { open: openDrawer, close: closeDrawer };
})();

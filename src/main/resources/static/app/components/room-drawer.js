// room-drawer.js
// После сохранения/удаления брони триггерим перекраску кабинетов на плане.

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const el = (id) => document.getElementById(id);

  const state = {
    open: false,
    current: null
  };

  async function apiGet(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return r.json();
  }
  async function apiPut(url, body) {
    const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text() || `PUT ${url} -> ${r.status}`);
    return r.json?.() ?? null;
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
    if (capInput) capInput.value = String(roomCtx.capacity ?? 0);

    Promise.all([
      fetchCurrentBookings(roomCtx).catch(() => []),
      fetchGroups().catch(() => [])
    ]).then(([bookings, groups]) => {
      renderCurrentBookings(bookings);
      renderGroups(groups);
      updateUsage(bookings, roomCtx.capacity || 0);
    }).catch(() => {});

    hydrateRoomMeta(roomCtx.classroomId).catch(() => {});

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
      if (Array.isArray(data)) return data.map(g => ({ id: g.id, name: g.name || g.title || `Группа ${g.id}` }));
      if (Array.isArray(data.content)) return data.content.map(g => ({ id: g.id, name: g.name || g.title || `Группа ${g.id}` }));
    } catch {}
    return [
      { id: 101, name: "Группа 101" },
      { id: 102, name: "Группа 102" },
      { id: 103, name: "Группа 103" }
    ];
  }

  async function fetchCurrentBookings(ctx) {
    const params = new URLSearchParams({
      classroomId: String(ctx.classroomId),
      dayOfWeek: ctx.dayOfWeek || "",
      weekParityType: ctx.weekParityType || "ANY"
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
      timeZoneId: ctx.timeZoneId,
      classroomId: ctx.classroomId,
      groupId: selectedGroupId
    };

    const r = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка сохранения (${r.status})`);
    return r.json();
  }

  async function deleteExistingBooking() {
    if (!state.current) return;
    const list = await fetchCurrentBookings(state.current);
    if (!list.length) throw new Error("Нет текущих бронирований для удаления.");
    const id = list[0].id;
    const r = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.text()) || `Ошибка удаления (${r.status})`);
  }

  async function hydrateRoomMeta(classroomId) {
    const [buildings, faculties, specs] = await Promise.all([
      loadBuildings().catch(() => []),
      loadFaculties().catch(() => []),
      loadSpecs().catch(() => [])
    ]);
    fillSelect(el("c-building"), buildings.map(b => ({ value: String(b.id), label: b.name })), true);
    fillSelect(el("c-faculty"),  faculties.map(f => ({ value: String(f.id), label: f.name })), true);
    fillSelect(el("c-spec"),     specs.map(s => ({ value: String(s.id), label: s.name })), true);

    try {
      const data = await apiGet(`/api/classrooms/${classroomId}`);
      if (data.capacity != null) el("c-cap").value = String(data.capacity);
      if (data.building?.id != null) el("c-building").value = String(data.building.id);
      else if (data.buildingId != null) el("c-building").value = String(data.buildingId);
      if (data.faculty?.id != null) el("c-faculty").value = String(data.faculty.id);
      else if (data.facultyId != null) el("c-faculty").value = String(data.facultyId);
      if (data.specialization?.id != null) el("c-spec").value = String(data.specialization.id);
      else if (data.specializationId != null) el("c-spec").value = String(data.specializationId);
    } catch {}
  }

  async function loadBuildings() {
    const data = await apiGet("/api/buildings?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map(b => ({ id: b.id, name: b.name || b.title || `Корпус ${b.id}` }));
  }
  async function loadFaculties() {
    const data = await apiGet("/api/faculties?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map(f => ({ id: f.id, name: f.name || f.title || `Факультет ${f.id}` }));
  }
  async function loadSpecs() {
    const data = await apiGet("/api/specializations?size=1000");
    const arr = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : [];
    return arr.map(s => ({ id: s.id, name: s.name || s.title || `Специализация ${s.id}` }));
  }

  function renderCurrentBookings(bookings) {
    const box = el("d-by");
    if (!bookings || !bookings.length) {
      box.textContent = "—";
      el("current-chips").innerHTML = "—";
      return;
    }
    const ids = bookings.map(b => b.groupId).filter(Boolean);
    box.textContent = ids.length ? `Группы: ${ids.join(", ")}` : "—";
    el("current-chips").innerHTML = ids.map(id => `<span class="chip"><b>${id}</b></span>`).join(" ") || "—";
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
      span.textContent = `${g.name} (id=${g.id})`;
      label.appendChild(span);
      box.appendChild(label);
    }
  }
  function updateUsage(bookings, capacity) {
    const total = Array.isArray(bookings) ? bookings.length : 0;
    el("usage-line").textContent = `${total} / ${capacity}`;
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

  // ===== Кнопки =====
  (function bindButtons() {
    el("d-close")?.addEventListener("click", closeDrawer);
    el("overlay")?.addEventListener("click", closeDrawer);

    el("save-book")?.addEventListener("click", async () => {
      try {
        const selected = document.querySelector('input[name="sel-group"]:checked');
        if (!selected) { alert("Выберите группу."); return; }
        await saveBooking(Number(selected.value));
        const bookings = await fetchCurrentBookings(state.current);
        renderCurrentBookings(bookings);
        updateUsage(bookings, state.current?.capacity || 0);
        window.planRefreshOccupancy?.();           // << перерисовать цвета на плане
        alert("Бронирование сохранено.");
      } catch (e) { alert(e.message || "Не удалось сохранить бронирование."); }
    });

    el("clear-book")?.addEventListener("click", async () => {
      try {
        await deleteExistingBooking();
        const bookings = await fetchCurrentBookings(state.current);
        renderCurrentBookings(bookings);
        updateUsage(bookings, state.current?.capacity || 0);
        window.planRefreshOccupancy?.();           // << перерисовать цвета на плане
        alert("Бронирование снято.");
      } catch (e) { alert(e.message || "Не удалось снять бронирование."); }
    });

    el("save-room-meta")?.addEventListener("click", async () => {
      try {
        if (!state.current) throw new Error("Кабинет не выбран.");
        const classroomId = state.current.classroomId;
        const body = {
          capacity: Number(el("c-cap").value || 0),
          buildingId: el("c-building").value ? Number(el("c-building").value) : null,
          facultyId: el("c-faculty").value ? Number(el("c-faculty").value) : null,
          specializationId: el("c-spec").value ? Number(el("c-spec").value) : null
        };
        await apiPut(`/api/classrooms/${classroomId}`, body);
        alert("Свойства кабинета сохранены.");
      } catch (e) {
        alert(e.message || "Не удалось сохранить кабинет.");
      }
    });
  })();

  window.RoomDrawer = { open: openDrawer, close: closeDrawer };
})();

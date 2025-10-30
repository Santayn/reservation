(function () {
  "use strict";

  // =========================
  // DOM helpers
  // =========================
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // =========================
  // STATE
  // =========================
  const state = {
    elements: [],          // все объекты на полотне
    selectedId: null,      // id выделенного элемента
    dragCtx: null,         // контекст перетаскивания
    resizeCtx: null,       // контекст ресайза

    buildings: [],         // [{id,name}, ...]
    layoutsByBuilding: new Map(), // buildingId -> [{id,name,floorNumber,layoutJson?}, ...]
    currentBuildingId: null,

    currentLayoutId: null, // если null => это новая схема
    currentLayoutDto: null // dto целиком {id, name, floorNumber, buildingId, layoutJson}
  };

  function makeId() {
    return "el-" + Math.random().toString(36).slice(2, 9);
  }

  // =========================
  // ФАБРИКА ЭЛЕМЕНТОВ
  // =========================
  function createElement(type) {
    const id = makeId();

    switch (type) {
      case "room":
        return {
          id,
          type: "room",
          x: 100,
          y: 100,
          width: 160,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeStyle: "solid",
          roomName: "Ауд. 101",
          capacity: 30,
          classroomId: 101,
          labelText: ""
        };

      case "corridor":
        return {
          id,
          type: "corridor",
          x: 200,
          y: 200,
          width: 200,
          height: 80,
          fill: "#eef3ff",
          stroke: "#3558d4",
          strokeStyle: "dashed",
          labelText: "Коридор / зона"
        };

      case "wall":
        return {
          id,
          type: "wall",
          x: 300,
          y: 150,
          width: 200,
          height: 10,
          fill: "#000000",
          stroke: "#000000",
          strokeStyle: "solid",
          labelText: "Стена"
        };

      case "door":
        return {
          id,
          type: "door",
          x: 250,
          y: 250,
          width: 60,
          height: 20,
          fill: "#fffbe6",
          stroke: "#8a6d00",
          strokeStyle: "solid",
          labelText: "Вход"
        };

      case "lift":
        return {
          id,
          type: "lift",
          x: 260,
          y: 260,
          width: 50,
          height: 50,
          fill: "#fff0f5",
          stroke: "#d81b60",
          strokeStyle: "solid",
          labelText: "Лифт"
        };

      case "stairs":
        return {
          id,
          type: "stairs",
          x: 320,
          y: 320,
          width: 70,
          height: 50,
          fill: "#e6f7ff",
          stroke: "#0074c2",
          strokeStyle: "solid",
          labelText: "Лестница"
        };

      case "wc":
        return {
          id,
          type: "wc",
          x: 400,
          y: 200,
          width: 70,
          height: 50,
          fill: "#fff0f5",
          stroke: "#d81b60",
          strokeStyle: "dashed",
          labelText: "WC"
        };

      case "label":
        return {
          id,
          type: "label",
          x: 200,
          y: 50,
          width: 140,
          height: 40,
          fill: "#ffffff",
          stroke: "#444444",
          strokeStyle: "dotted",
          labelText: "Надпись"
        };

      case "round":
        return {
          id,
          type: "round",
          x: 450,
          y: 100,
          width: 100,
          height: 100,
          fill: "#f0fff6",
          stroke: "#1e6824",
          strokeStyle: "dashed",
          labelText: "Зона"
        };

      case "rect":
        return {
          id,
          type: "rect",
          x: 80,
          y: 80,
          width: 150,
          height: 100,
          fill: "#fff8dc",
          stroke: "#444444",
          strokeStyle: "dashed",
          labelText: "Прямоугольник"
        };

      case "oval":
        return {
          id,
          type: "oval",
          x: 500,
          y: 200,
          width: 140,
          height: 80,
          fill: "#e3f2fd",
          stroke: "#444444",
          strokeStyle: "solid",
          labelText: "Овал"
        };

      case "semicircle":
        return {
          id,
          type: "semicircle",
          x: 600,
          y: 250,
          width: 120,
          height: 60,
          fill: "#fff0e6",
          stroke: "#ff6f00",
          strokeStyle: "solid",
          labelText: "Полукруг"
        };

      default:
        return {
          id,
          type: "rect",
          x: 50,
          y: 50,
          width: 150,
          height: 100,
          fill: "#fff8dc",
          stroke: "#444444",
          strokeStyle: "dashed",
          labelText: "Прямоугольник"
        };
    }
  }

  // =========================
  // CANVAS
  // =========================
  const canvasEl = $("#canvas");

  function renderAll() {
    renderCanvas();
    renderInspector();
    renderJsonPreview();
  }

  function renderCanvas() {
    canvasEl.innerHTML = "";

    state.elements.forEach(el => {
      const node = document.createElement("div");
      node.className = "le-elem";
      node.dataset.id = el.id;

      node.style.left = el.x + "px";
      node.style.top  = el.y + "px";

      let w = el.width;
      let h = el.height;

      if (el.type === "round") {
        const d = el.width;
        node.style.width = d + "px";
        node.style.height = d + "px";
        node.style.borderRadius = "50%";
      } else if (el.type === "oval") {
        node.style.width = w + "px";
        node.style.height = h + "px";
        node.style.borderRadius = "50%";
      } else if (el.type === "semicircle") {
        node.style.width = w + "px";
        node.style.height = h + "px";
        node.style.borderTopLeftRadius  = (h * 2) + "px";
        node.style.borderTopRightRadius = (h * 2) + "px";
        node.style.borderBottomLeftRadius = "0";
        node.style.borderBottomRightRadius = "0";
      } else {
        node.style.width = w + "px";
        node.style.height = h + "px";
        node.style.borderRadius = "4px";
      }

      node.style.backgroundColor = el.fill || "#fff";
      node.style.borderColor     = el.stroke || "#000";
      node.style.borderStyle     = el.strokeStyle || "solid";
      node.style.borderWidth     = "2px";
      node.style.boxSizing       = "border-box";

      node.style.color        = "#111";
      node.style.fontSize     = "13px";
      node.style.lineHeight   = "1.2";
      node.style.textAlign    = "center";
      node.style.display      = "flex";
      node.style.alignItems   = "center";
      node.style.justifyContent = "center";
      node.style.padding      = "4px";
      node.style.userSelect   = "none";
      node.style.cursor       = "move";

      let textContent = "";
      switch (el.type) {
        case "room": {
          const rn = el.roomName || "Ауд. ?";
          const cap = Number(el.capacity || 0);
          textContent = `${rn} (${cap})`;
          break;
        }
        case "corridor":
          textContent = el.labelText || "Коридор";
          break;
        case "wall":
          textContent = el.labelText || "Стена";
          node.style.color = "#fff";
          node.style.fontSize = "11px";
          break;
        case "door":
          textContent = el.labelText || "Вход";
          break;
        case "lift":
          textContent = el.labelText || "Лифт";
          break;
        case "stairs":
          textContent = el.labelText || "Лестница";
          break;
        case "wc":
          textContent = el.labelText || "WC";
          break;
        case "label":
          textContent = el.labelText || "Надпись";
          break;
        case "round":
          textContent = el.labelText || "Зона";
          break;
        case "oval":
          textContent = el.labelText || "Овал";
          break;
        case "semicircle":
          textContent = el.labelText || "Полукруг";
          break;
        case "rect":
          textContent = el.labelText || "Прямоугольник";
          break;
        default:
          textContent = el.labelText || el.type;
      }
      node.textContent = textContent;

      if (state.selectedId === el.id) {
        node.classList.add("selected");
        addResizeHandles(node, el);
      }

      node.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        selectElement(el.id);
        startDrag(ev, el.id);
      });

      canvasEl.appendChild(node);
    });
  }

  function addResizeHandles(node, el) {
    const corners = ["tl", "tr", "bl", "br"];
    corners.forEach(corner => {
      const h = document.createElement("div");
      h.className = "le-resize-handle " + corner;
      h.dataset.corner = corner;
      h.dataset.id = el.id;
      h.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        startResize(ev, el.id, corner);
      });
      node.appendChild(h);
    });
  }

  // =========================
  // INSPECTOR
  // =========================
  function renderInspector() {
    const formEl = $("#inspector-form");
    const emptyEl = $("#no-selection");

    const sel = getSelected();
    if (!sel) {
      formEl.style.display = "none";
      emptyEl.style.display = "block";
      return;
    }

    formEl.style.display = "block";
    emptyEl.style.display = "none";

    $("#inp-id").value = sel.id;
    $("#inp-type").value = sel.type;

    $("#inp-x").value = sel.x ?? 0;
    $("#inp-y").value = sel.y ?? 0;

    if (sel.type === "round") {
      $("#circle-radius-row").style.display = "";
      $("#size-row").style.display = "none";
      $("#inp-radius").value = sel.width;
    } else {
      $("#circle-radius-row").style.display = "none";
      $("#size-row").style.display = "";
      $("#inp-w").value = sel.width ?? 0;
      $("#inp-h").value = sel.height ?? 0;
    }

    $("#inp-fill").value = sel.fill || "#ffffff";
    $("#inp-stroke").value = sel.stroke || "#000000";
    $("#inp-stroke-style").value = sel.strokeStyle || "solid";

    if (sel.type === "room") {
      $("#room-extra").style.display = "";
      $("#inp-room-name").value = sel.roomName ?? "";
      $("#inp-room-capacity").value = sel.capacity ?? 0;
      $("#inp-room-id").value = sel.classroomId ?? "";
    } else {
      $("#room-extra").style.display = "none";
    }

    const needsLabel =
      sel.type === "label" ||
      sel.type === "wc" ||
      sel.type === "lift" ||
      sel.type === "stairs" ||
      sel.type === "door" ||
      sel.type === "corridor" ||
      sel.type === "wall" ||
      sel.type === "round" ||
      sel.type === "oval" ||
      sel.type === "semicircle" ||
      sel.type === "rect";

    if (needsLabel) {
      $("#label-extra").style.display = "";
      $("#inp-label-text").value = sel.labelText ?? "";
    } else {
      $("#label-extra").style.display = "none";
      $("#inp-label-text").value = "";
    }
  }

  // =========================
  // JSON PREVIEW
  // =========================
  function renderJsonPreview() {
    const area = $("#save-json-area");

    const buildingId = parseInt($("#sel-building")?.value ?? "", 10) || null;
    const floorStr = $("#inp-floor-number")?.value ?? "";
    const floorNumber = floorStr === "" ? null : (parseInt(floorStr, 10) || 0);
    const layoutName = $("#inp-layout-name")?.value || "";

    const payload = {
      buildingId: buildingId,
      floorNumber: floorNumber,
      name: layoutName || "Без названия",
      layoutJson: JSON.stringify({
        elements: state.elements
      })
    };

    area.value = JSON.stringify(payload, null, 2);
  }

  // =========================
  // SELECTION / EDIT
  // =========================
  function getSelected() {
    if (!state.selectedId) return null;
    return state.elements.find(e => e.id === state.selectedId) || null;
  }

  function selectElement(id) {
    state.selectedId = id;
    renderAll();
  }

  // PALETTE
  function handlePaletteClick(ev) {
    const type = ev.currentTarget.getAttribute("data-create");
    if (!type) return;
    const el = createElement(type);
    state.elements.push(el);
    state.selectedId = el.id;
    renderAll();
  }

  // DRAG MOVE
  function startDrag(ev, id) {
    const el = state.elements.find(e => e.id === id);
    if (!el) return;

    state.dragCtx = {
      id,
      startX: ev.clientX,
      startY: ev.clientY,
      initX: el.x,
      initY: el.y
    };

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", stopDrag);
  }

  function onDragMove(ev) {
    if (!state.dragCtx) return;
    const ctx = state.dragCtx;
    const el = state.elements.find(e => e.id === ctx.id);
    if (!el) return;

    const dx = ev.clientX - ctx.startX;
    const dy = ev.clientY - ctx.startY;

    el.x = ctx.initX + dx;
    el.y = ctx.initY + dy;

    renderCanvas();
    renderInspector();
    renderJsonPreview();
  }

  function stopDrag() {
    state.dragCtx = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", stopDrag);
  }

  // RESIZE
  function startResize(ev, id, corner) {
    const el = state.elements.find(e => e.id === id);
    if (!el) return;

    state.resizeCtx = {
      id,
      corner,
      startX: ev.clientX,
      startY: ev.clientY,
      initX: el.x,
      initY: el.y,
      initW: el.width,
      initH: el.height
    };

    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", stopResize);
  }

  function onResizeMove(ev) {
    if (!state.resizeCtx) return;
    const ctx = state.resizeCtx;
    const el = state.elements.find(e => e.id === ctx.id);
    if (!el) return;

    const dx = ev.clientX - ctx.startX;
    const dy = ev.clientY - ctx.startY;

    const isRound = el.type === "round";

    let newX = el.x;
    let newY = el.y;
    let newW = el.width;
    let newH = isRound ? el.width : el.height;

    switch (ctx.corner) {
      case "br":
        newW = ctx.initW + dx;
        newH = ctx.initH + dy;
        break;
      case "bl":
        newX = ctx.initX + dx;
        newW = ctx.initW - dx;
        newH = ctx.initH + dy;
        break;
      case "tr":
        newY = ctx.initY + dy;
        newH = ctx.initH - dy;
        newW = ctx.initW + dx;
        break;
      case "tl":
        newX = ctx.initX + dx;
        newW = ctx.initW - dx;
        newY = ctx.initY + dy;
        newH = ctx.initH - dy;
        break;
    }

    if (isRound) {
      const d = Math.max(20, Math.max(newW, newH));
      el.x = newX;
      el.y = newY;
      el.width = d;
      el.height = d;
    } else {
      el.x = newX;
      el.y = newY;
      el.width = Math.max(10, newW);
      el.height = Math.max(10, newH);
    }

    renderCanvas();
    renderInspector();
    renderJsonPreview();
  }

  function stopResize() {
    state.resizeCtx = null;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", stopResize);
  }

  // =========================
  // INSPECTOR CHANGE HANDLERS
  // =========================
  function bindInspectorInputs() {
    $("#inp-x").addEventListener("input", onInspectorChange);
    $("#inp-y").addEventListener("input", onInspectorChange);
    $("#inp-w").addEventListener("input", onInspectorChange);
    $("#inp-h").addEventListener("input", onInspectorChange);
    $("#inp-radius").addEventListener("input", onInspectorChange);

    $("#inp-fill").addEventListener("input", onInspectorChange);
    $("#inp-stroke").addEventListener("input", onInspectorChange);
    $("#inp-stroke-style").addEventListener("change", onInspectorChange);

    $("#inp-room-name").addEventListener("input", onInspectorChange);
    $("#inp-room-capacity").addEventListener("input", onInspectorChange);
    $("#inp-room-id").addEventListener("input", onInspectorChange);

    $("#inp-label-text").addEventListener("input", onInspectorChange);

    // метаданные схемы → только превью
    $("#sel-building")?.addEventListener("change", onBuildingChangedExternal);
    $("#inp-floor-number")?.addEventListener("input", renderJsonPreview);
    $("#inp-layout-name")?.addEventListener("input", renderJsonPreview);
  }

  function onInspectorChange() {
    const el = getSelected();
    if (!el) return;

    const newX = parseFloat($("#inp-x").value);
    const newY = parseFloat($("#inp-y").value);
    if (!Number.isNaN(newX)) el.x = newX;
    if (!Number.isNaN(newY)) el.y = newY;

    if (el.type === "round") {
      const d = parseFloat($("#inp-radius").value);
      if (!Number.isNaN(d) && d > 0) {
        el.width = d;
        el.height = d;
      }
    } else {
      const newW = parseFloat($("#inp-w").value);
      const newH = parseFloat($("#inp-h").value);
      if (!Number.isNaN(newW) && newW > 0) el.width = newW;
      if (!Number.isNaN(newH) && newH > 0) el.height = newH;
    }

    el.fill = $("#inp-fill").value || el.fill;
    el.stroke = $("#inp-stroke").value || el.stroke;
    el.strokeStyle = $("#inp-stroke-style").value || el.strokeStyle;

    if (el.type === "room") {
        el.roomName = $("#inp-room-name").value;
        el.capacity = parseInt($("#inp-room-capacity").value, 10) || 0;
        el.classroomId = parseInt($("#inp-room-id").value, 10) || 0;
    }

    const needsLabel =
      el.type === "label" ||
      el.type === "wc" ||
      el.type === "lift" ||
      el.type === "stairs" ||
      el.type === "door" ||
      el.type === "corridor" ||
      el.type === "wall" ||
      el.type === "round" ||
      el.type === "oval" ||
      el.type === "semicircle" ||
      el.type === "rect";

    if (needsLabel) {
      el.labelText = $("#inp-label-text").value;
    }

    renderAll();
  }

  // =========================
  // BUILD PAYLOAD для бэка
  // =========================
  function buildLayoutPayloadForServer() {
    const buildingId = parseInt($("#sel-building")?.value ?? "", 10) || null;
    const floorStr = $("#inp-floor-number")?.value ?? "";
    const floorNumber = floorStr === "" ? null : (parseInt(floorStr, 10) || 0);
    const layoutName = $("#inp-layout-name")?.value || "Без названия";

    const layoutData = {
      elements: state.elements
    };

    return {
      buildingId: buildingId,
      floorNumber: floorNumber,
      name: layoutName,
      layoutJson: JSON.stringify(layoutData)
    };
  }

  function getCsrfHeaderMaybe() {
    const tokenMeta = document.querySelector('meta[name="_csrf"]');
    const headerMeta = document.querySelector('meta[name="_csrf_header"]');
    if (tokenMeta && headerMeta) {
      return { name: headerMeta.content, value: tokenMeta.content };
    }
    return null;
  }

  async function postLayout(payload) {
    // создание новой схемы: POST /api/layouts
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrfHeaderMaybe();
    if (csrf) headers[csrf.name] = csrf.value;

    const resp = await fetch("/api/layouts", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "include"
    });
    return resp;
  }

  async function putLayout(layoutId, payload) {
    // обновление существующей схемы
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrfHeaderMaybe();
    if (csrf) headers[csrf.name] = csrf.value;

    const resp = await fetch(`/api/layouts/${layoutId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
      credentials: "include"
    });
    return resp;
  }

  async function deleteLayout(layoutId) {
    const headers = {};
    const csrf = getCsrfHeaderMaybe();
    if (csrf) headers[csrf.name] = csrf.value;

    const resp = await fetch(`/api/layouts/${layoutId}`, {
      method: "DELETE",
      headers,
      credentials: "include"
    });
    return resp;
  }

  async function getLayoutsForBuilding(buildingId) {
    const resp = await fetch(`/api/layouts/by-building/${buildingId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }

  async function getLayoutById(layoutId) {
    const resp = await fetch(`/api/layouts/${layoutId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (!resp.ok) return null;
    return await resp.json(); // {id,name,buildingId,floorNumber,layoutJson}
  }

  // =========================
  // TOP BAR BUTTONS
  // =========================
  function bindTopBarButtons() {
    $("#btn-save").addEventListener("click", onSaveClicked);
    $("#btn-clear").addEventListener("click", onClearCanvasClicked);
    $("#btn-delete-elem").addEventListener("click", onDeleteElementClicked);

    $("#btn-load-layout").addEventListener("click", onLoadLayoutClicked);
    $("#btn-delete-layout").addEventListener("click", onDeleteLayoutClicked);
  }

  async function onSaveClicked() {
    const buildingIdStr = $("#sel-building").value.trim();
    const floorStr      = $("#inp-floor-number").value.trim();
    const nameStr       = $("#inp-layout-name").value.trim();

    if (!buildingIdStr) {
      alert("Выбери здание / корпус.");
      return;
    }
    if (!floorStr) {
      alert("Укажи номер этажа.");
      return;
    }
    if (!nameStr) {
      alert("Введи название схемы / этажа.");
      return;
    }

    const reqBody = buildLayoutPayloadForServer();

    try {
      let resp;
      // если currentLayoutId == null → новая схема (POST)
      // иначе → обновление (PUT)
      if (state.currentLayoutId == null) {
        resp = await postLayout(reqBody);
      } else {
        resp = await putLayout(state.currentLayoutId, reqBody);
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        alert("Ошибка сохранения схемы.\n" + (errText || ("HTTP " + resp.status)));
        return;
      }

      const saved = await resp.json();
      state.currentLayoutId  = saved.id;
      state.currentLayoutDto = saved;

      // перегружаем список схем для текущего корпуса
      await refreshLayoutsInUI();

      // выставим селект на только что сохранённую схему
      $("#sel-existing-layout").value = String(saved.id);

      alert(
        "Схема сохранена.\n" +
        "ID схемы: " + saved.id + "\n" +
        "Корпус: " + (saved.buildingId ?? "—") + "\n" +
        "Этаж: " + (saved.floorNumber ?? "—") + "\n" +
        "Название: " + saved.name
      );
    } catch (e) {
      console.error(e);
      alert("Сервер недоступен или сеть прервалась. Схема не сохранена.");
    }
  }

  function onClearCanvasClicked() {
    if (!confirm("Точно очистить полотно целиком?")) return;
    state.elements = [];
    state.selectedId = null;
    renderAll();
  }

  function onDeleteElementClicked() {
    const sel = getSelected();
    if (!sel) {
      alert("Нечего удалять — элемент не выбран.");
      return;
    }
    if (!confirm(`Удалить элемент ${sel.id}?`)) return;

    state.elements = state.elements.filter(e => e.id !== sel.id);
    state.selectedId = null;
    renderAll();
  }

  // =========================
  // LOAD / DELETE LAYOUT (из БД)
  // =========================
  async function onLoadLayoutClicked() {
    const layoutId = pickSelectedLayoutId();
    if (!layoutId) {
      // выбрана "— новая схема —"
      resetEditorToNewScheme();
      return;
    }

    const dto = await getLayoutById(layoutId);
    if (!dto) {
      alert("Не удалось загрузить схему с сервера.");
      return;
    }

    // dto: {id,name,buildingId,floorNumber,layoutJson}
    loadDtoIntoEditor(dto);
  }

  async function onDeleteLayoutClicked() {
    const layoutId = pickSelectedLayoutId();
    if (!layoutId) {
      alert("Сначала выбери схему (не 'новая схема').");
      return;
    }
    const ok = confirm("Удалить эту схему целиком?");
    if (!ok) return;

    const resp = await deleteLayout(layoutId);
    if (!resp.ok) {
      alert("Не удалось удалить схему (сервер вернул ошибку).");
      return;
    }

    // после удаления перезагружаем список схем корпуса
    await refreshLayoutsInUI();
    resetEditorToNewScheme();

    alert("Схема удалена.");
  }

  function pickSelectedLayoutId() {
    const raw = $("#sel-existing-layout").value;
    if (!raw) return null;
    const idNum = parseInt(raw, 10);
    return Number.isNaN(idNum) ? null : idNum;
  }

  function resetEditorToNewScheme() {
    state.currentLayoutId  = null;
    state.currentLayoutDto = null;
    state.elements = [];
    state.selectedId = null;

    $("#sel-existing-layout").value = "";
    $("#inp-floor-number").value = "";
    $("#inp-layout-name").value  = "";

    renderAll();
  }

  function loadDtoIntoEditor(dto) {
    state.currentLayoutId  = dto.id;
    state.currentLayoutDto = dto;

    // выставим тело формы
    $("#sel-building").value = dto.buildingId != null ? String(dto.buildingId) : "";
    $("#inp-floor-number").value = dto.floorNumber != null ? dto.floorNumber : "";
    $("#inp-layout-name").value  = dto.name || "";

    // разбор layoutJson → elements
    let parsedEls = [];
    try {
      const parsed = dto.layoutJson ? JSON.parse(dto.layoutJson) : {};
      if (parsed && Array.isArray(parsed.elements)) {
        parsedEls = parsed.elements;
      }
    } catch (e) {
      console.warn("layoutJson не парсится у схемы", e);
    }

    state.elements = parsedEls.map(e => ({...e}));
    state.selectedId = null;

    renderAll();
  }

  // =========================
  // BUILDINGS + LAYOUT LIST
  // =========================
  async function loadBuildingsToSelect() {
    const sel = $("#sel-building");
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— выберите здание —";
    sel.appendChild(opt0);

    try {
      const resp = await fetch("/api/buildings", {
        method: "GET",
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      if (!resp.ok) {
        console.warn("Не удалось загрузить здания, HTTP " + resp.status);
        return;
      }
      const list = await resp.json(); // [{id,name},...]
      state.buildings = Array.isArray(list) ? list : [];
      state.buildings.forEach(b => {
        const opt = document.createElement("option");
        opt.value = String(b.id);
        opt.textContent = b.name || ("Здание #" + b.id);
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error("Ошибка загрузки корпусов:", e);
      state.buildings = [];
    }
  }

  async function refreshLayoutsInUI() {
    // перечитать схемы для текущего здания и заполнить селект
    const bId = state.currentBuildingId;
    if (!bId) {
      fillLayoutsSelect([]);
      return;
    }

    const list = await getLayoutsForBuilding(bId);
    state.layoutsByBuilding.set(bId, list);
    fillLayoutsSelect(list);
  }

  function fillLayoutsSelect(list) {
    const selLay = $("#sel-existing-layout");
    selLay.innerHTML = "";

    // "новая схема"
    {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— новая схема —";
      selLay.appendChild(opt);
    }

    list.forEach(l => {
      const floorPart = (l.floorNumber != null)
        ? `этаж ${l.floorNumber}`
        : "этаж ?";
      const namePart = l.name ? ` — ${l.name}` : "";
      const opt = document.createElement("option");
      opt.value = String(l.id);
      opt.textContent = floorPart + namePart;
      selLay.appendChild(opt);
    });

    // если у нас уже есть текущая схема, выставим её
    if (state.currentLayoutId != null) {
      selLay.value = String(state.currentLayoutId);
    } else {
      selLay.value = "";
    }
  }

  async function onBuildingChangedExternal() {
    // пользователь сменил корпус вручную в инспекторе/шапке
    const raw = $("#sel-building").value;
    const bId = raw === "" ? null : parseInt(raw, 10);
    state.currentBuildingId = (bId == null || Number.isNaN(bId)) ? null : bId;

    // обновляем список схем для этого корпуса
    await refreshLayoutsInUI();

    // если я сменил корпус, но редактирую уже существующую схему от другого корпуса —
    // оставляем текущие элементы, но это может стать "новой схемой" при сохранении.
    renderJsonPreview();
  }

  // =========================
  // CANVAS background click
  // =========================
  canvasEl.addEventListener("mousedown", (ev) => {
    if (ev.target === canvasEl) {
      state.selectedId = null;
      renderAll();
    }
  });

  // =========================
  // INIT
  // =========================
  function initPaletteButtons() {
    $$(".le-tool-btn").forEach(btn => {
      btn.addEventListener("click", handlePaletteClick);
    });
  }

  function bindTopUIEvents() {
    // уже есть bindTopBarButtons()
    // но нам нужно ещё слушать смену корпуса отдельно в onBuildingChangedExternal()
    $("#sel-building").addEventListener("change", onBuildingChangedExternal);
  }

  async function init() {
    initPaletteButtons();
    bindInspectorInputs();
    bindTopBarButtons();
    bindTopUIEvents();

    await loadBuildingsToSelect();

    // после загрузки корпусов:
    // выберем первый корпус (если есть) по умолчанию
    if (state.buildings.length > 0) {
      state.currentBuildingId = state.buildings[0].id;
      $("#sel-building").value = String(state.currentBuildingId);
      await refreshLayoutsInUI(); // подгрузим схемы
    } else {
      // корпусов нет
      fillLayoutsSelect([]);
    }

    // стартуем в режиме "новая схема"
    resetEditorToNewScheme();
  }

  init();

})();

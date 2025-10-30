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
    elements: [],        // все объекты на полотне
    selectedId: null,    // id выделенного элемента
    dragCtx: null,       // контекст перетаскивания
    resizeCtx: null      // контекст ресайза
  };

  function makeId() {
    return "el-" + Math.random().toString(36).slice(2, 9);
  }

  // =========================
  // ФАБРИКА ЭЛЕМЕНТОВ
  // =========================
  // Общие поля для большинства:
  //  - id
  //  - type
  //  - x, y
  //  - width, height
  //  - fill, stroke, strokeStyle
  //  - labelText
  //
  // Спец. поля для room:
  //  - roomName
  //  - capacity
  //  - classroomId
  //
  // Спец. форма:
  //  - round  -> круг, width==height, рендер border-radius:50%, инспектор управляет диаметром
  //  - oval   -> овал (эллипс), border-radius:50%, но ширина и высота независимы
  //  - semicircle -> полукруг. Рисуем «полудиск» (верхняя дуга), через большие радиусы двух верхних углов
  function createElement(type) {
    const id = makeId();

    switch (type) {

      case "room": // аудитория
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

      case "corridor": // коридор / зона
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

      case "wall": // стена
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

      case "door": // дверь / вход
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

      case "lift": // лифт
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

      case "stairs": // лестница
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

      case "wc": // туалет
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

      case "label": // подпись/надпись
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

      case "round": // круглая зона / атриум
        return {
          id,
          type: "round",
          x: 450,
          y: 100,
          width: 100,
          height: 100, // width==height
          fill: "#f0fff6",
          stroke: "#1e6824",
          strokeStyle: "dashed",
          labelText: "Зона"
        };

      case "rect": // обычный прямоугольник / блок
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

      case "oval": // овал / эллипс
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

      case "semicircle": // полукруг
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
        // fallback на rect
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
  // РЕНДЕР ВСЕГО
  // =========================
  const canvasEl = $("#canvas");

  function renderAll() {
    renderCanvas();
    renderInspector();
    renderJsonPreview();
  }

  // --------- CANVAS RENDER ----------
  function renderCanvas() {
    canvasEl.innerHTML = "";

    state.elements.forEach(el => {
      const node = document.createElement("div");
      node.className = "le-elem";
      node.dataset.id = el.id;

      // позиция
      node.style.left = el.x + "px";
      node.style.top = el.y + "px";

      // базовые размеры
      let w = el.width;
      let h = el.height;

      // форма
      if (el.type === "round") {
        // круг: держим width==height
        const d = el.width;
        node.style.width = d + "px";
        node.style.height = d + "px";
        node.style.borderRadius = "50%";
      } else if (el.type === "oval") {
        node.style.width = w + "px";
        node.style.height = h + "px";
        node.style.borderRadius = "50%"; // эллипс
      } else if (el.type === "semicircle") {
        node.style.width = w + "px";
        node.style.height = h + "px";
        // делаем нечто похожее на верхний полукруг:
        // большие радиусы сверху, маленькие снизу
        node.style.borderTopLeftRadius = (h * 2) + "px";
        node.style.borderTopRightRadius = (h * 2) + "px";
        node.style.borderBottomLeftRadius = "0";
        node.style.borderBottomRightRadius = "0";
      } else {
        // прямоугольники, комнаты, коридоры, стены, двери, лифты и т.д.
        node.style.width = w + "px";
        node.style.height = h + "px";
        node.style.borderRadius = "4px";
      }

      // цвета / рамка
      node.style.backgroundColor = el.fill || "#fff";
      node.style.borderColor = el.stroke || "#000";
      node.style.borderStyle = el.strokeStyle || "solid";
      node.style.borderWidth = "2px";
      node.style.boxSizing = "border-box";

      // текстовые стили
      node.style.color = "#111";
      node.style.fontSize = "13px";
      node.style.lineHeight = "1.2";
      node.style.textAlign = "center";
      node.style.display = "flex";
      node.style.alignItems = "center";
      node.style.justifyContent = "center";
      node.style.padding = "4px";
      node.style.userSelect = "none";

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

      // выделение
      if (state.selectedId === el.id) {
        node.classList.add("selected");
        addResizeHandles(node, el);
      }

      // обработчики
      node.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        selectElement(el.id);
        startDrag(ev, el.id);
      });

      canvasEl.appendChild(node);
    });
  }

  // рисуем ручки по углам
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

  // --------- INSPECTOR RENDER ----------
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

    // Общие поля
    $("#inp-id").value = sel.id;
    $("#inp-type").value = sel.type;

    $("#inp-x").value = sel.x ?? 0;
    $("#inp-y").value = sel.y ?? 0;

    // Размеры
    if (sel.type === "round") {
      // round управляется диаметром
      $("#circle-radius-row").style.display = "";
      $("#size-row").style.display = "none";
      $("#inp-radius").value = sel.width;
    } else {
      $("#circle-radius-row").style.display = "none";
      $("#size-row").style.display = "";
      $("#inp-w").value = sel.width ?? 0;
      $("#inp-h").value = sel.height ?? 0;
    }

    // Цвета и рамка
    $("#inp-fill").value = sel.fill || "#ffffff";
    $("#inp-stroke").value = sel.stroke || "#000000";
    $("#inp-stroke-style").value = sel.strokeStyle || "solid";

    // ROOM block
    if (sel.type === "room") {
      $("#room-extra").style.display = "";
      $("#inp-room-name").value = sel.roomName ?? "";
      $("#inp-room-capacity").value = sel.capacity ?? 0;
      $("#inp-room-id").value = sel.classroomId ?? "";
    } else {
      $("#room-extra").style.display = "none";
    }

    // LABEL/TEXT block
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

  // --------- JSON PREVIEW ----------
  function renderJsonPreview() {
    const area = $("#save-json-area");
    const data = {
      elements: state.elements
    };
    area.value = JSON.stringify(data, null, 2);
  }

  // =========================
  // SELECTION
  // =========================
  function getSelected() {
    if (!state.selectedId) return null;
    return state.elements.find(e => e.id === state.selectedId) || null;
  }

  function selectElement(id) {
    state.selectedId = id;
    renderAll();
  }

  // =========================
  // PALETTE CLICK
  // =========================
  function handlePaletteClick(ev) {
    const type = ev.currentTarget.getAttribute("data-create");
    if (!type) return;

    const el = createElement(type);
    state.elements.push(el);
    state.selectedId = el.id;
    renderAll();
  }

  // =========================
  // DRAG MOVE
  // =========================
  function startDrag(ev, id) {
    const el = state.elements.find(e => e.id === id);
    if (!el) return;

    const startX = ev.clientX;
    const startY = ev.clientY;
    const initX = el.x;
    const initY = el.y;

    state.dragCtx = { id, startX, startY, initX, initY };

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

  // =========================
  // RESIZE
  // =========================
  function startResize(ev, id, corner) {
    const el = state.elements.find(e => e.id === id);
    if (!el) return;

    const startX = ev.clientX;
    const startY = ev.clientY;

    state.resizeCtx = {
      id,
      corner,
      startX,
      startY,
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
      // круг: держим одинаковый диаметр
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
  }

  function onInspectorChange() {
    const el = getSelected();
    if (!el) return;

    // координаты
    const newX = parseFloat($("#inp-x").value);
    const newY = parseFloat($("#inp-y").value);
    if (!Number.isNaN(newX)) el.x = newX;
    if (!Number.isNaN(newY)) el.y = newY;

    // размеры
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

    // стили
    el.fill = $("#inp-fill").value || el.fill;
    el.stroke = $("#inp-stroke").value || el.stroke;
    el.strokeStyle = $("#inp-stroke-style").value || el.strokeStyle;

    // Аудитория
    if (el.type === "room") {
      el.roomName = $("#inp-room-name").value;
      el.capacity = parseInt($("#inp-room-capacity").value, 10) || 0;
      el.classroomId = parseInt($("#inp-room-id").value, 10) || 0;
    }

    // Подпись
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
  // TOP BAR BUTTONS
  // =========================
  function bindTopBarButtons() {
    $("#btn-save").addEventListener("click", onSaveClicked);
    $("#btn-clear").addEventListener("click", onClearClicked);
    $("#btn-delete").addEventListener("click", onDeleteClicked);
  }

  function onSaveClicked() {
    const payload = { elements: state.elements };
    console.log("SAVE SCHEMA:", payload);
    alert("Схема собрана. Проверь JSON внизу или в консоли.");
  }

  function onClearClicked() {
    if (!confirm("Точно очистить полотно целиком?")) return;
    state.elements = [];
    state.selectedId = null;
    renderAll();
  }

  function onDeleteClicked() {
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
  function init() {
    // палитра
    $$(".le-tool-btn").forEach(btn => {
      btn.addEventListener("click", handlePaletteClick);
    });

    bindInspectorInputs();
    bindTopBarButtons();

    renderAll();
  }

  init();
})();

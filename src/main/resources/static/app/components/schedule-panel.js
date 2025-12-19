// schedule-panel.js
// Панель параметров "Серия" + утилиты. Работает и если скрипт загружен после DOM.

(function () {
  "use strict";

  const WEEK_TYPES = [
    { value: "ANY",  label: "обычная (без чётности)" },
    { value: "EVEN", label: "чётная" },
    { value: "ODD",  label: "нечётная" }
  ];

  const DAYS = [
    { value: "MONDAY",    label: "Понедельник" },
    { value: "TUESDAY",   label: "Вторник" },
    { value: "WEDNESDAY", label: "Среда" },
    { value: "THURSDAY",  label: "Четверг" },
    { value: "FRIDAY",    label: "Пятница" },
    { value: "SATURDAY",  label: "Суббота" },
    { value: "SUNDAY",    label: "Воскресенье" }
  ];

  const $ = (sel) => document.querySelector(sel);

  function fillSelect(el, options, placeholder) {
    if (!el) return;
    el.innerHTML = "";
    if (placeholder) {
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = placeholder;
      el.appendChild(ph);
    }
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      el.appendChild(opt);
    }
  }

  function init() {
    const modeWeekly = $("#sch-mode-weekly");
    const modeParity = $("#sch-mode-parity");
    const weekType   = $("#sch-weektype");
    const daySel     = $("#sch-day");
    const tzInput    = $("#sch-tz");

    fillSelect(weekType, WEEK_TYPES);
    fillSelect(daySel, DAYS, "— выберите день —");

    if (tzInput && !tzInput.value) tzInput.value = "Europe/Berlin";

    function onModeChange() {
      weekType.disabled = false;
      daySel.disabled = false;
    }
    modeWeekly?.addEventListener("change", onModeChange);
    modeParity?.addEventListener("change", onModeChange);
    onModeChange();
  }

  function getSettings() {
    const day = $("#sch-day")?.value || "";
    const weekParityType = $("#sch-weektype")?.value || "ANY";
    const timeZoneId = $("#sch-tz")?.value?.trim() || "Europe/Berlin";
    return { dayOfWeek: day, weekParityType, timeZoneId };
  }

  function dayOfWeekFromDateStr(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const jsDow = d.getDay(); // 0..6 (Sun..Sat)
    const map = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    return map[jsDow];
  }

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  ready(init);

  window.SchedulePanel = { init, getSettings, dayOfWeekFromDateStr };
})();

// ===== Общие утилиты =====
function getCookie(name){
  return document.cookie.split('; ').find(row=>row.startsWith(name+'='))?.split('=')[1];
}
function decode(s){ try { return decodeURIComponent(s); } catch { return s; } }
const csrfToken = decode(getCookie('XSRF-TOKEN') || '');
const csrfHeader = csrfToken ? {"X-CSRF-TOKEN": csrfToken} : {};
function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

// ===== Состояние страницы =====
const state = {
  slotFilter: document.getElementById('slot-filter'),
  dateInput:  document.getElementById('date-input'),

  SLOT_LIST: [],
  CLASSROOMS: new Map(),       // name -> {id,name,capacity}
  CLASSROOM_META: new Map(),   // id -> {id,facultyIds:[...],specializationIds:[...],buildingId?}

  selectedSlotId: null,
  selectedDate: new Date().toISOString().slice(0,10),

  ME: { id:null, login:null },

  roomBookings: {},

  PRESETS: { faculties:[], specs:[], buildings:[] },

  ALL_GROUPS: [],

  FILTER: { facultyId:null, specId:null },

  // мини-фильтр долгосрочного расписания (ТОЛЬКО режим + день)
  SCHEDULE: {
    mode: 'WEEKLY',        // 'WEEKLY' | 'PARITY'
    weekType: null,        // 'EVEN' | 'ODD' (только при PARITY)
    dayOfWeek: 1           // 1..7
  },

  // для визуального выделения
  SELECTED_EL: null
};
state.dateInput.value = state.selectedDate;

// >>> NEW: экспорт расписания для любого модуля (drawer будет это звать)
window.getSchedulePayload = function getSchedulePayload() {
  const m = (state && state.SCHEDULE) ? state.SCHEDULE : {mode:'WEEKLY', weekType:null, dayOfWeek:1};
  return {
    scheduleMode: (m.mode === 'PARITY') ? 'PARITY' : 'WEEKLY',
    scheduleWeekParity: (m.mode === 'PARITY') ? (m.weekType || 'EVEN') : null,
    scheduleDayOfWeek: Number(m.dayOfWeek || 1) // 1..7
  };
};

// >>> NEW: удобный мерджер перед отправкой в /api/bookings
window.attachSchedule = function attachSchedule(body = {}) {
  return Object.assign(body, window.getSchedulePayload());
};

// ====== API helpers (локально для страницы) ======
async function apiLoadMe(){
  try{
    const me = await (await fetch('/api/v1/users/me', {credentials:'same-origin'})).json();
    state.ME.id = me.id; state.ME.login = me.login;
  }catch{}
}

async function apiLoadSlots(){
  try{
    const res = await fetch('/api/slots', {credentials:'same-origin'});
    if (!res.ok) throw new Error('slots api not ready');
    const list = await res.json();
    state.SLOT_LIST = list.map(s=>{
      const from = s.from ?? s.startAt ?? null;
      const to   = s.to   ?? s.endAt   ?? null;
      return {id: Number(s.id), from, to};
    });
  }catch{
    const FALLBACK = [
      ['08:00','09:30'], ['09:40','11:10'], ['11:20','12:50'],
      ['13:20','14:50'], ['15:00','16:30'], ['16:40','18:10'], ['18:20','19:50'],
    ];
    state.SLOT_LIST = FALLBACK.map((p,i)=>({id:i+1, from:p[0], to:p[1]}));
  }
  // отрисовать select
  state.slotFilter.innerHTML = '';
  state.SLOT_LIST.forEach(s=>{
    const o=document.createElement('option');
    o.value=s.id;
    o.textContent = (s.from && s.to) ? `${s.from}–${s.to}` : `Слот #${s.id}`;
    state.slotFilter.appendChild(o);
  });
  state.selectedSlotId = state.SLOT_LIST.length ? state.SLOT_LIST[0].id : null;
  if (state.selectedSlotId != null) state.slotFilter.value = String(state.selectedSlotId);
}

async function apiLoadClassrooms(){
  try{
    const res = await fetch('/api/classrooms', {credentials:'same-origin'});
    if (!res.ok) throw new Error('classrooms api not ready');
    const list = await res.json(); // [{id,name,capacity}]
    state.CLASSROOMS = new Map(list.map(c => [c.name, {id:c.id, name:c.name, capacity:Number(c.capacity||0)}]));
    document.querySelectorAll('.room').forEach(el=>{
      const c = state.CLASSROOMS.get(el.dataset.room);
      if (c) {
        el.dataset.classroomId = String(c.id);
        el.dataset.capacity    = String(c.capacity ?? 0);
        const base = el.textContent.replace(/\s*\(\d+\)\s*$/,'');
        el.textContent = `${base} (${c.capacity ?? 0})`;
      }
    });
  }catch(e){
    console.warn('Не удалось загрузить /api/classrooms. Будет автосоздание через ensure в drawer.');
  }
}

// Пытаемся получить метаданные всех кабинетов разом, иначе — по одному (лениво)
async function apiLoadClassroomMeta(){
  // 1. массово
  try{
    const r = await fetch('/api/classrooms/meta', {credentials:'same-origin'});
    if (r.ok){
      const list = await r.json();
      state.CLASSROOM_META = new Map(list.map(m => [String(m.id), {
        id:Number(m.id),
        facultyIds:(m.facultyIds||[]).map(Number),
        specializationIds:(m.specializationIds||[]).map(Number),
        buildingId: Number(m.buildingId ?? m.buildingID ?? m.building_id ?? 0)
      }]));
      return;
    }
  }catch{}
  // 2. fallback — по одному
  const entries = [...state.CLASSROOMS.values()];
  const limit = 6; let i = 0;
  async function loadOne(c){
    try{
      const r = await fetch(`/api/classrooms/${c.id}`, {credentials:'same-origin'});
      if (!r.ok) return;
      const dto = await r.json();
      state.CLASSROOM_META.set(String(c.id), {
        id: c.id,
        facultyIds: (dto.facultyIds||[]).map(Number),
        specializationIds: (dto.specializationIds||[]).map(Number),
        buildingId: Number(dto.buildingId ?? dto.buildingID ?? dto.building_id ?? 0)
      });
    }catch{}
  }
  async function worker(){
    while (i < entries.length){
      const c = entries[i++]; await loadOne(c);
    }
  }
  await Promise.all(Array.from({length:limit}, worker));
}

async function apiLoadGroups(){
  try{
    const res = await fetch('/api/groups', {credentials:'same-origin'});
    const list = await res.json();
    state.ALL_GROUPS = (Array.isArray(list)?list:[]).map(g=>({
      id: Number(g.id),
      name: g.name,
      size: Number((g.size ?? g.capacity ?? g.personsCount) || 0)
    }));
  }catch{ state.ALL_GROUPS = []; }
}

async function apiLoadPresets(){
  try { state.PRESETS.faculties = await (await fetch('/api/faculties',{credentials:'same-origin'})).json(); } catch { state.PRESETS.faculties = []; }
  try { state.PRESETS.specs     = await (await fetch('/api/specializations',{credentials:'same-origin'})).json(); } catch { state.PRESETS.specs = []; }
  try { state.PRESETS.buildings = await (await fetch('/api/buildings',{credentials:'same-origin'})).json(); } catch { state.PRESETS.buildings = []; }
}

async function apiLoadBookingsBySlot({date, slotId}){
  const res = await fetch(`/api/bookings/by-slot?date=${encodeURIComponent(date)}&slotId=${slotId}`, {credentials:'same-origin'});
  if (!res.ok) return [];
  return await res.json();
}

// ====== Раскраска (утил.) ======
function sumSize(groups){ return groups.reduce((a,g)=>a + (Number(g.size)||0), 0); }
function statusBy(capacity, used){
  if (used <= 0) return 'idle';
  if (capacity <= 0) return 'ok';
  const ratio = used / capacity;
  if (ratio <= 1)    return 'ok';
  if (ratio <= 1.25) return 'warn';
  if (ratio <= 1.50) return 'danger';
  return 'over';
}
function recolorAll(){
  document.querySelectorAll('.room').forEach(el=>{
    if (el.classList.contains('foyer')) return;
    const cap  = Number(el.dataset.capacity||0);
    const name = el.dataset.room;
    const rb   = state.roomBookings[name]?.[state.selectedSlotId] || null;
    const groups = rb?.groups || [];
    const used   = sumSize(groups);
    const st     = statusBy(cap, used);

    el.classList.remove('idle','ok','warn','danger','over');
    el.classList.add(st);

    const who = rb?.by ? `\nЗанято: ${rb.by}` : (groups.length ? '\nЗанято' : '\nСвободно');
    el.title = `${name}\nВместимость: ${cap}\nНазначено: ${used}${who}`;
  });
}

// серверная утил.
async function fetchUtilization(dateStr, slotId) {
  const url = `/api/utilization?date=${encodeURIComponent(dateStr)}&slotId=${encodeURIComponent(slotId)}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials:'same-origin' });
  if (!resp.ok) throw new Error(`utilization ${resp.status}`);
  return resp.json();
}
function mapBadgeToClass(badgeClass, capacity, load) {
  if (badgeClass) {
    switch (badgeClass) {
      case 'util-empty': return 'idle';
      case 'util-25':
      case 'util-50':
      case 'util-100':  return 'ok';
      case 'util-over': {
        const ratio = capacity > 0 ? load / capacity : 0;
        if (ratio <= 1.25) return 'warn';
        if (ratio <= 1.50) return 'danger';
        return 'over';
      }
    }
  }
  if (load <= 0) return 'idle';
  if (capacity <= 0 || load <= capacity) return 'ok';
  const ratio = load / capacity;
  if (ratio <= 1.25) return 'warn';
  if (ratio <= 1.50) return 'danger';
  return 'over';
}
async function recolorFromApi() {
  try {
    if (!state.selectedDate || state.selectedSlotId == null) return;
    const util = await fetchUtilization(state.selectedDate, Number(state.selectedSlotId));
    const byId = new Map(util.map(u => [String(u.classroomId), u]));

    document.querySelectorAll('.room').forEach(el => {
      if (el.classList.contains('foyer')) return;

      const id = el.dataset.classroomId;
      const info = id ? byId.get(String(id)) : null;

      el.classList.remove('idle','ok','warn','danger','over');

      if (!info) {
        el.classList.add('idle');
        el.title = `${el.dataset.room}\nВместимость: ${el.dataset.capacity || 0}\nНазначено: 0\nСвободно`;
        return;
      }

      const cap  = Number(info.capacity || 0);
      const load = Number(info.load || 0);
      const css  = mapBadgeToClass(info.badgeClass, cap, load);

      el.classList.add(css);
      el.title = `${el.dataset.room}\nВместимость: ${cap}\nНазначено: ${load}`;
    });
  } catch (e) {
    console.warn('utilization fallback to local calc', e);
    recolorAll();
  }
}

// ====== ВЫБОР АУДИТОРИИ (рамка поверх окраса) ======
function markSelected(el){
  if (state.SELECTED_EL && state.SELECTED_EL !== el){
    state.SELECTED_EL.classList.remove('selected');
  }
  state.SELECTED_EL = el || null;
  if (el) el.classList.add('selected');
}
function clearSelected(){
  if (state.SELECTED_EL){
    state.SELECTED_EL.classList.remove('selected');
    state.SELECTED_EL = null;
  }
}

// ====== ФИЛЬТР ======
function fillFilterOptions(){
  const selF = document.getElementById('flt-faculty');
  const selS = document.getElementById('flt-spec');

  selF.innerHTML = '<option value="">— любой —</option>' +
    (state.PRESETS.faculties||[]).map(f=>`<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');

  selS.innerHTML = '<option value="">— любая —</option>' +
    (state.PRESETS.specs||[]).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  selF.value = state.FILTER.facultyId ?? '';
  selS.value = state.FILTER.specId ?? '';
}

// НЕ скрываем, а помечаем совпадения рамкой (.filter-hit) и приглушаем остальные (.dim)
function applyVisibilityFilter(){
  const fId = state.FILTER.facultyId ? Number(state.FILTER.facultyId) : null;
  const sId = state.FILTER.specId ? Number(state.FILTER.specId) : null;
  const active = !!(fId || sId);

  const match = (meta)=>{
    if (!meta) return false; // без метаданных — не совпадение
    const okF = !fId || (meta.facultyIds||[]).includes(fId);
    const okS = !sId || (meta.specializationIds||[]).includes(sId);
    return okF && okS;
  };

  document.querySelectorAll('.room').forEach(el=>{
    if (el.classList.contains('foyer')) return;

    el.classList.remove('filter-hit','dim');

    if (!active) return;

    const id = el.dataset.classroomId ? String(el.dataset.classroomId) : null;
    const meta = id ? state.CLASSROOM_META.get(id) : null;

    if (match(meta)) {
      el.classList.add('filter-hit');
      el.classList.remove('dim');
    } else {
      el.classList.add('dim');
    }
  });
}

// ====== Мини-фильтр расписания (режим + день) ======
function wireScheduleMiniFilter(){
  const rWeekly  = document.getElementById('sch-mode-weekly');
  const rParity  = document.getElementById('sch-mode-parity');
  const selParity= document.getElementById('sch-parity');
  const selDay   = document.getElementById('sch-day');

  if (!rWeekly || !rParity || !selParity || !selDay) return;

  if (selDay.options.length === 0){
    const days = [
      [1,'Понедельник'],[2,'Вторник'],[3,'Среда'],
      [4,'Четверг'],[5,'Пятница'],[6,'Суббота'],[7,'Воскресенье']
    ];
    selDay.innerHTML = days.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
  }

  rWeekly.checked = state.SCHEDULE.mode === 'WEEKLY';
  rParity.checked = state.SCHEDULE.mode === 'PARITY';
  selParity.value = state.SCHEDULE.weekType || 'EVEN';
  selDay.value    = String(state.SCHEDULE.dayOfWeek || 1);
  selParity.disabled = !rParity.checked;

  const emit = ()=>{
    state.SCHEDULE = {
      mode: rParity.checked ? 'PARITY' : 'WEEKLY',
      weekType: rParity.checked ? selParity.value : null,
      dayOfWeek: Number(selDay.value || 1)
    };
    // >>> NEW: уведомим остальные части UI (drawer может слушать, если нужно)
    document.dispatchEvent(new CustomEvent('schedule:change', { detail: window.getSchedulePayload() }));
  };

  rWeekly.addEventListener('change', ()=>{ selParity.disabled = true;  emit(); });
  rParity.addEventListener('change', ()=>{ selParity.disabled = false; emit(); });
  selParity.addEventListener('change', emit);
  selDay.addEventListener('change', emit);

  emit();
}

// ====== Переключатели/слушатели ======
function wireUi(){
  // drawer
  const drawer = new window.RoomDrawer({});
  drawer.setContext({
    state,
    onRepaint: async ()=>{ await recolorFromApi(); applyVisibilityFilter(); },
    onClose:   ()=>{ clearSelected(); }
  });

  // мини-фильтр расписания
  wireScheduleMiniFilter();

  document.querySelectorAll('.room').forEach(el=>{
    if (el.classList.contains('foyer')) return;
    el.addEventListener('click', ()=>{
      markSelected(el);
      drawer.open(el);
    });
  });

  // этажи
  document.querySelectorAll('.floor-switch button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.floor-switch button').forEach(b=>{
        b.classList.remove('active'); b.setAttribute('aria-pressed','false');
      });
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      const f=btn.dataset.floor;
      document.querySelectorAll('.floor').forEach(x=>x.classList.toggle('active', x.dataset.floor===f));
      clearSelected();
    });
  });

  // слот/дата
  state.slotFilter.addEventListener('change', async ()=>{
    state.selectedSlotId = Number(state.slotFilter.value);
    clearSelected();
    await reloadBookingsAndPaint();
    await recolorFromApi();
    applyVisibilityFilter();
  });
  state.dateInput.addEventListener('change', async ()=>{
    state.selectedDate = state.dateInput.value || new Date().toISOString().slice(0,10);
    clearSelected();
    await reloadBookingsAndPaint();
    await recolorFromApi();
    applyVisibilityFilter();
  });

  // фильтр — меню
  const btn = document.getElementById('filter-btn');
  const menu = document.getElementById('filter-menu');
  btn.addEventListener('click', ()=>{
    if (!menu.classList.contains('open')) fillFilterOptions();
    menu.classList.toggle('open');
  });
  document.getElementById('flt-apply').addEventListener('click', ()=>{
    const selF = document.getElementById('flt-faculty');
    const selS = document.getElementById('flt-spec');
    state.FILTER.facultyId = selF.value ? Number(selF.value) : null;
    state.FILTER.specId    = selS.value ? Number(selS.value) : null;
    applyVisibilityFilter();
    menu.classList.remove('open');
  });
  document.getElementById('flt-clear').addEventListener('click', ()=>{
    state.FILTER = {facultyId:null, specId:null};
    fillFilterOptions();
    applyVisibilityFilter();
  });

  // клик вне меню — закрыть
  document.addEventListener('click', (e)=>{
    const wrap = document.querySelector('.filter-wrap');
    const menu = document.getElementById('filter-menu');
    if (wrap && !wrap.contains(e.target)) menu.classList.remove('open');
  });
}

// ====== Перезагрузка бронирований ======
async function reloadBookingsAndPaint(){
  Object.keys(state.roomBookings).forEach(k=> state.roomBookings[k] = {});
  try{
    const list = await apiLoadBookingsBySlot({date: state.selectedDate, slotId: Number(state.selectedSlotId)});
    list.forEach(b=>{
      const roomName = b.classroomName || [...state.CLASSROOMS.values()].find(c=>c.id===b.classroomId)?.name;
      if (!roomName) return;
      if (!state.roomBookings[roomName]) state.roomBookings[roomName] = {};
      const groups = (b.groups || []).map(g=>({id:g.id, name:g.name, size:Number(g.size ?? g.capacity ?? g.personsCount ?? 0)}));
      const by = b.bookedBy || b.createdByName || b.createdByLogin || null;
      state.roomBookings[roomName][state.selectedSlotId] = { id: b.id, groups, by };
    });
  }catch(e){
    console.warn('Не удалось загрузить бронирования по слоту:', e);
  }
  recolorAll();
}

// ====== init ======
(async function init(){
  await apiLoadMe();
  await apiLoadPresets();
  await apiLoadSlots();
  await apiLoadClassrooms();
  await apiLoadClassroomMeta();
  await apiLoadGroups();
  await reloadBookingsAndPaint();
  await recolorFromApi();

  wireUi();
  applyVisibilityFilter();
})();

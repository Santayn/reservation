(function(){
  // ---------- STATE ----------
  const slotFilter = document.getElementById('slot-filter');
  const dateInput  = document.getElementById('date-input');

  const STATE = {
    SLOT_LIST: [],
    CLASSROOMS: new Map(), // name -> {id, name, capacity}
    selectedSlotId: null,
    selectedDate: new Date().toISOString().slice(0,10),
    ME: { id: null, login: null },
    roomBookings: {},      // roomName -> { slotId -> {id?, groups:[{id,name,size}], by?} }
    ALL_GROUPS: [],
    PRESETS: { faculties: [], specs: [], buildings: [] }
  };
  dateInput.value = STATE.selectedDate;

  // ---------- UTILS ----------
  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
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

  async function fetchJSON(url){
    const r = await fetch(url, {credentials:'same-origin'});
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return await r.json();
  }

  // ---------- LOADERS ----------
  async function loadMe(){
    try { const me = await fetchJSON('/api/v1/users/me'); STATE.ME = {id: me.id, login: me.login}; } catch {}
  }

  async function loadSlots(){
    try{
      const list = await fetchJSON('/api/slots');
      STATE.SLOT_LIST = list.map(s=>{
        const from = s.from ?? s.startAt ?? null;
        const to   = s.to   ?? s.endAt   ?? null;
        return {id: Number(s.id), from, to};
      });
    }catch{
      const FALLBACK = [
        ['08:00','09:30'], ['09:40','11:10'], ['11:20','12:50'],
        ['13:20','14:50'], ['15:00','16:30'], ['16:40','18:10'], ['18:20','19:50'],
      ];
      STATE.SLOT_LIST = FALLBACK.map((p,i)=>({id:i+1, from:p[0], to:p[1]}));
    }
    slotFilter.innerHTML = STATE.SLOT_LIST.map(s=>`<option value="${s.id}">${s.from && s.to ? `${s.from}–${s.to}` : `Слот #${s.id}`}</option>`).join('');
    STATE.selectedSlotId = STATE.SLOT_LIST.length ? STATE.SLOT_LIST[0].id : null;
    if (STATE.selectedSlotId != null) slotFilter.value = String(STATE.selectedSlotId);
  }

  async function loadClassrooms(){
    try{
      const list = await fetchJSON('/api/classrooms'); // [{id,name,capacity}]
      STATE.CLASSROOMS = new Map(list.map(c => [c.name, {id:c.id, name:c.name, capacity:Number(c.capacity||0)}]));
      document.querySelectorAll('.room').forEach(el=>{
        const c = STATE.CLASSROOMS.get(el.dataset.room);
        if (c) {
          el.dataset.classroomId = String(c.id);
          el.dataset.capacity    = String(c.capacity ?? 0);
          const base = el.textContent.replace(/\s*\(\d+\)\s*$/,'');
          el.textContent = `${base} (${c.capacity ?? 0})`;
        }
      });
    }catch{
      // допустим, бэка нет — аудитории создадим на лету из drawer
    }
  }

  async function loadGroups(){
    try{
      const list = await fetchJSON('/api/groups');
      STATE.ALL_GROUPS = (Array.isArray(list)?list:[]).map(g=>({
        id: Number(g.id),
        name: g.name,
        size: Number((g.size ?? g.capacity ?? g.personsCount) || 0)
      }));
    }catch{ STATE.ALL_GROUPS = []; }
  }

  async function loadPresets(){
    try { STATE.PRESETS.faculties = await fetchJSON('/api/faculties'); } catch {}
    try { STATE.PRESETS.specs     = await fetchJSON('/api/specializations'); } catch {}
    try { STATE.PRESETS.buildings = await fetchJSON('/api/buildings'); } catch {}
  }

  async function apiLoadBookingsBySlot(date, slotId){
    try{
      return await fetchJSON(`/api/bookings/by-slot?date=${encodeURIComponent(date)}&slotId=${slotId}`);
    }catch{ return []; }
  }

  // ---------- COLORING ----------
  async function fetchUtilization(dateStr, slotId) {
    const resp = await fetch(`/api/utilization?date=${encodeURIComponent(dateStr)}&slotId=${encodeURIComponent(slotId)}`, { credentials:'same-origin' });
    if (!resp.ok) throw new Error(`utilization ${resp.status}`);
    return resp.json(); // [{ classroomId, capacity, load, badgeClass }]
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

  function recolorLocal(){
    document.querySelectorAll('.room').forEach(el=>{
      if (el.classList.contains('foyer')) return;
      const cap  = Number(el.dataset.capacity||0);
      const name = el.dataset.room;
      const rb   = STATE.roomBookings[name]?.[STATE.selectedSlotId] || null;
      const groups = rb?.groups || [];
      const used   = sumSize(groups);
      const st     = statusBy(cap, used);
      el.classList.remove('idle','ok','warn','danger','over');
      el.classList.add(st);
      const who = rb?.by ? `\nЗанято: ${rb.by}` : (groups.length ? '\nЗанято' : '\nСвободно');
      el.title = `${name}\nВместимость: ${cap}\nНазначено: ${used}${who}`;
    });
  }

  async function recolorFromApiOrLocal(){
    try{
      if (!STATE.selectedDate || STATE.selectedSlotId == null) return;
      const util = await fetchUtilization(STATE.selectedDate, Number(STATE.selectedSlotId));
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
    }catch{
      recolorLocal();
    }
  }

  async function reloadBookingsAndPaint(){
    Object.keys(STATE.roomBookings).forEach(k=> STATE.roomBookings[k] = {});
    const list = await apiLoadBookingsBySlot(STATE.selectedDate, Number(STATE.selectedSlotId));
    list.forEach(b=>{
      const roomName = b.classroomName || [...STATE.CLASSROOMS.values()].find(c=>c.id===b.classroomId)?.name;
      if (!roomName) return;
      if (!STATE.roomBookings[roomName]) STATE.roomBookings[roomName] = {};
      const groups = (b.groups || []).map(g=>({id:g.id, name:g.name, size:Number(g.size ?? g.capacity ?? g.personsCount ?? 0)}));
      const by = b.bookedBy || b.createdByName || b.createdByLogin || null;
      STATE.roomBookings[roomName][STATE.selectedSlotId] = { id: b.id, groups, by };
    });
    await recolorFromApiOrLocal();
  }

  // ---------- Drawer ----------
  const drawer = new RoomDrawer({overlayId:'overlay', drawerId:'drawer'});
  drawer.setContext({
    state: STATE,
    onRepaint: async ()=>{ await reloadBookingsAndPaint(); }
  });

  // ---------- Handlers ----------
  // клики по комнатам
  document.querySelectorAll('.room').forEach(el=>{
    if (!el.classList.contains('foyer')) {
      el.addEventListener('click', ()=>drawer.open(el));
    }
  });

  // этажи
  document.querySelectorAll('.floor-switch button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.floor-switch button').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      const f=btn.dataset.floor;
      document.querySelectorAll('.floor').forEach(x=>x.classList.toggle('active', x.dataset.floor===f));
    });
  });

  slotFilter.addEventListener('change', async ()=>{
    STATE.selectedSlotId = Number(slotFilter.value);
    await reloadBookingsAndPaint();
  });

  dateInput.addEventListener('change', async ()=>{
    STATE.selectedDate = dateInput.value || new Date().toISOString().slice(0,10);
    await reloadBookingsAndPaint();
  });

  // ---------- INIT ----------
  (async function init(){
    await loadMe();
    await loadPresets();
    await loadSlots();        // наполняет селект и ставит selectedSlotId
    await loadClassrooms();   // подвязывает id/вместимость в разметку
    await loadGroups();
    await reloadBookingsAndPaint();
  })();
})();

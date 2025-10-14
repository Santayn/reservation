// components/room-drawer.js
(function(){
  // --- локальный CSRF (как на странице) ---
  function getCookie(name){
    return document.cookie.split('; ')
      .find(row=>row.startsWith(name+'='))?.split('=')[1];
  }
  function decode(s){ try { return decodeURIComponent(s); } catch { return s; } }
  const csrfToken = decode(getCookie('XSRF-TOKEN') || '');
  const csrfHeader = csrfToken ? {"X-CSRF-TOKEN": csrfToken} : {};
  const debugHeader = {"X-Debug-Mark": "room-drawer"};

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function sumSize(groups){ return groups.reduce((a,g)=>a + (Number(g.size)||0), 0); }

  function getActiveFloor() {
    const btn = document.querySelector('.floor-switch button.active');
    const v = btn?.getAttribute('data-floor');
    return v ? Number(v) : 1;
  }

  /**
   * Нормализуем расписание в оба формата:
   * - новый: scheduleType/weekType/dayOfWeek/timezone/floor
   * - старый (для совместимости с POST /api/bookings): scheduleMode/scheduleWeekParity/scheduleDayOfWeek
   */
  function buildSchedulePayload(ctx){
    const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    let raw = null;

    if (typeof window.getSchedulePayload === 'function') {
      raw = window.getSchedulePayload() || {};
    } else if (ctx?.state?.SCHEDULE) {
      raw = {
        mode: ctx.state.SCHEDULE.mode,
        weekType: ctx.state.SCHEDULE.weekType,
        dayOfWeek: ctx.state.SCHEDULE.dayOfWeek
      };
    } else {
      raw = {};
    }

    // распознаём оба варианта входа
    const scheduleType = raw.scheduleType
      ? (raw.scheduleType === 'PARITY' ? 'PARITY' : 'WEEKLY')
      : ((raw.mode === 'PARITY') ? 'PARITY' : 'WEEKLY');

    const weekType = raw.weekType
      ? (scheduleType === 'WEEKLY' ? 'STABLE' : (raw.weekType || 'EVEN'))
      : (scheduleType === 'WEEKLY' ? 'STABLE' : (raw.scheduleWeekParity || raw.weekType || 'EVEN'));

    const dayOfWeek = Number(
      raw.dayOfWeek ?? raw.scheduleDayOfWeek ?? 1
    );

    const timezone = raw.timezone || tzGuess;
    const floor = Number(raw.floor ?? getActiveFloor());

    // старый формат для /api/bookings
    const scheduleMode = scheduleType;
    const scheduleWeekParity = (scheduleType === 'PARITY') ? (weekType || 'EVEN') : null;
    const scheduleDayOfWeek = dayOfWeek;

    return {
      // новый формат
      scheduleType, weekType, dayOfWeek, timezone, floor,
      // совместимость
      scheduleMode, scheduleWeekParity, scheduleDayOfWeek
    };
  }

  class RoomDrawer {
    constructor(){
      // DOM
      this.overlay   = document.getElementById('overlay');
      this.drawer    = document.getElementById('drawer');
      this.dClose    = document.getElementById('d-close');
      this.dRoom     = document.getElementById('d-room');
      this.dCapLbl   = document.getElementById('d-cap');
      this.dSlot     = document.getElementById('d-slot');
      this.dBy       = document.getElementById('d-by');
      this.groupsBox = document.getElementById('groups-box');
      this.chips     = document.getElementById('current-chips');
      this.usageLine = document.getElementById('usage-line');
      this.saveBtn   = document.getElementById('save-book');
      this.clearBtn  = document.getElementById('clear-book');
      this.saveSeriesBtn = document.getElementById('save-series'); // NEW

      // поля «Сведения о кабинете» (single select!)
      this.saveMetaBtn = document.getElementById('save-room-meta');
      this.capInp    = document.getElementById('c-cap');
      this.buildSel  = document.getElementById('c-building');
      this.facSel    = document.getElementById('c-faculty');
      this.specSel   = document.getElementById('c-spec');

      this.currentRoomEl = null;

      this.overlay.addEventListener('click', ()=>this.close());
      this.dClose.addEventListener('click', ()=>this.close());
    }

    // контекст от страницы (state + коллбеки)
    setContext(ctx){
      this.ctx = ctx || {};
      this.fillDictionaries();
    }

    // ===== API =====
    async apiCreateBooking({date, slotId, classroomId, groupIds}){
      // добавим расписание (для совместимости бэк просто проигнорит)
      const sched = buildSchedulePayload(this.ctx);
      const body = { date, slotId, classroomId, groupIds,
        scheduleMode: sched.scheduleMode,
        scheduleWeekParity: sched.scheduleWeekParity,
        scheduleDayOfWeek: sched.scheduleDayOfWeek
      };
      const res = await fetch('/api/bookings', {
        method:'POST',
        headers:{'Content-Type':'application/json', ...csrfHeader, ...debugHeader},
        credentials:'same-origin',
        body: JSON.stringify(body)
      });
      if(!res.ok) throw new Error(await res.text().catch(()=>res.statusText));
      return await res.json();
    }

    // NEW: создать серию
    async apiCreateSeries(payload){
      // для трассировки увидим заголовок и тело в логах фильтра
      const res = await fetch('/api/booking-series', {
        method:'POST',
        headers:{'Content-Type':'application/json', ...csrfHeader, ...debugHeader},
        credentials:'same-origin',
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(await res.text().catch(()=>res.statusText));
      return await res.json();
    }

    async apiDeleteBookingById(id){
      const res = await fetch(`/api/bookings/${id}`, {
        method:'DELETE', headers:{...csrfHeader, ...debugHeader}, credentials:'same-origin'
      });
      return res.ok;
    }
    async apiDeleteBookingByKey({date, slotId, classroomId}){
      const url = `/api/bookings/by-key?date=${encodeURIComponent(date)}&slotId=${slotId}&classroomId=${classroomId}`;
      const res = await fetch(url, {method:'DELETE', headers:{...csrfHeader, ...debugHeader}, credentials:'same-origin'});
      if (!res.ok && res.status !== 404) throw new Error(await res.text().catch(()=>res.statusText));
    }
    async apiEnsureClassroom(name, capacity){
      const r = await fetch('/api/classrooms/ensure', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json', ...csrfHeader, ...debugHeader},
        body: JSON.stringify({ name, capacity })
      });
      if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
      return await r.json();
    }
    async apiGetClassroom(id){
      const r = await fetch(`/api/classrooms/${id}`, {credentials:'same-origin', headers:{...debugHeader}});
      if (!r.ok) throw new Error('Не удалось загрузить кабинет');
      return await r.json();
    }
    async apiUpdateClassroom(id, payload){
      const r = await fetch(`/api/classrooms/${id}`, {
        method:'PUT', credentials:'same-origin',
        headers:{'Content-Type':'application/json', ...csrfHeader, ...debugHeader},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
      return await r.json();
    }

    // ===== UI helpers =====
    renderGroupsSelector(selected){
      this.groupsBox.innerHTML = '';
      const selIds = new Set(selected.map(g=>g.id));
      (this.ctx.state.ALL_GROUPS || []).forEach(g=>{
        const row = document.createElement('label');
        row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
        row.innerHTML =
          `<input type="checkbox" value="${g.id}" ${selIds.has(g.id)?'checked':''}
                  aria-label="Выбрать группу ${escapeHtml(g.name)}">
           <span>${escapeHtml(g.name)}</span>
           <span class="muted">(${g.size})</span>`;
        this.groupsBox.appendChild(row);
      });
    }
    renderCurrentChips(selected){
      this.chips.innerHTML = selected.length ? '' : '—';
      selected.forEach(g=>{
        const div = document.createElement('div');
        div.className='chip';
        div.innerHTML = `<b>${escapeHtml(g.name)}</b> <span class="muted">(${g.size})</span>
                         <button type="button" data-x="${g.id}" aria-label="Убрать ${escapeHtml(g.name)}"
                           style="margin-left:6px;border:none;background:transparent;cursor:pointer">✕</button>`;
        this.chips.appendChild(div);
      });
    }
    calcAndPaintUsage(cap, selected){
      const used = sumSize(selected);
      this.usageLine.textContent = `${used} / ${cap}`;
    }
    getSelectedFromBoxes(){
      const checked = [...this.groupsBox.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>Number(cb.value));
      const map = new Map(this.ctx.state.ALL_GROUPS.map(g=>[g.id,g]));
      return checked.map(id=>map.get(id)).filter(Boolean);
    }

    fillDictionaries(){
      const b = this.ctx.state?.PRESETS?.buildings || [];
      this.buildSel.innerHTML =
        '<option value="">— не выбрано —</option>' +
        b.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
      const f = this.ctx.state?.PRESETS?.faculties || [];
      this.facSel.innerHTML =
        '<option value="">— не выбрано —</option>' +
        f.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
      const s = this.ctx.state?.PRESETS?.specs || [];
      this.specSel.innerHTML =
        '<option value="">— не выбрано —</option>' +
        s.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
    }

    fillRoomForm(dto){
      this.capInp.value = dto.capacity ?? 0;
      this.buildSel.value = dto.buildingId ?? '';

      const fac  = (dto.facultyIds || [])[0] ?? '';
      const spec = (dto.specializationIds || [])[0] ?? '';
      this.facSel.value  = fac;
      this.specSel.value = spec;
    }

    collectRoomForm(){
      const cap = Number(this.capInp.value || 0);
      const buildingId = this.buildSel.value ? Number(this.buildSel.value) : null;
      const facultyId  = this.facSel.value ? Number(this.facSel.value) : null;
      const specId     = this.specSel.value ? Number(this.specSel.value) : null;

      const facultyIds = facultyId ? [facultyId] : [];
      const specializationIds = specId ? [specId] : [];
      return { capacity: cap, buildingId, facultyIds, specializationIds };
    }

    async open(el){
      if (!el || el.classList.contains('foyer')) return;

      this.currentRoomEl = el;
      const name = el.dataset.room;
      const cap  = Number(el.dataset.capacity||0);
      const slotObj = this.ctx.state.SLOT_LIST.find(s=>s.id===Number(this.ctx.state.selectedSlotId));

      this.dRoom.textContent = name;
      this.dCapLbl.textContent  = cap;
      this.dSlot.textContent = slotObj ? `${slotObj.from ?? ''}–${slotObj.to ?? ''}` : String(this.ctx.state.selectedSlotId);

      const rb = this.ctx.state.roomBookings[name]?.[this.ctx.state.selectedSlotId] || null;
      this.dBy.textContent = rb?.by || '—';

      const selected = rb ? [...rb.groups] : [];
      this.renderGroupsSelector(selected);
      this.renderCurrentChips(selected);
      this.calcAndPaintUsage(cap, selected);

      this.overlay.classList.add('open');
      this.drawer.classList.add('open');
      this.drawer.setAttribute('aria-hidden','false');

      // Ensure classroom id; fill meta
      (async ()=>{
        if (!el.dataset.classroomId){
          try{
            const dto = await this.apiEnsureClassroom(name, cap);
            el.dataset.classroomId = String(dto.id);
            el.dataset.capacity = String(dto.capacity ?? cap);
            const base = el.textContent.replace(/\s*\(\d+\)\s*$/,'');
            el.textContent = `${base} (${dto.capacity ?? cap})`;
            this.ctx.state.CLASSROOMS.set(name, {id:dto.id, name, capacity: dto.capacity ?? cap});
          }catch(e){ console.warn('ensure classroom failed', e); }
        }
        if (el.dataset.classroomId){
          try{
            const dto = await this.apiGetClassroom(Number(el.dataset.classroomId));
            this.ctx.state.CLASSROOM_META.set(String(dto.id), {
              id: dto.id,
              facultyIds: (dto.facultyIds||[]).map(Number),
              specializationIds: (dto.specializationIds||[]).map(Number)
            });
            this.fillRoomForm(dto);
          }catch{}
        }
      })();

      // Удаление чипа = снять чекбокс
      this.chips.onclick = (e)=>{
        const id = Number(e.target?.dataset?.x);
        if (!id) return;
        this.groupsBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
          if (Number(cb.value)===id) cb.checked = false;
        });
        const ns = this.getSelectedFromBoxes();
        this.renderCurrentChips(ns); this.calcAndPaintUsage(cap, ns);
      };
      this.groupsBox.onchange = ()=>{
        const ns = this.getSelectedFromBoxes();
        this.renderCurrentChips(ns); this.calcAndPaintUsage(cap, ns);
      };

      // Сохранить разовую бронь
      this.saveBtn.onclick = async ()=>{
        const sel = this.getSelectedFromBoxes();
        const classroomId = Number(el.dataset.classroomId);
        if (!classroomId) { alert('Не найден ID аудитории.'); return; }
        try{
          const resp = await this.apiCreateBooking({
            date: this.ctx.state.selectedDate,
            slotId: Number(this.ctx.state.selectedSlotId),
            classroomId,
            groupIds: sel.map(g=>g.id)
          });
          const by = this.ctx.state.ME.login || resp?.bookedBy || '—';
          if (!this.ctx.state.roomBookings[name]) this.ctx.state.roomBookings[name] = {};
          this.ctx.state.roomBookings[name][this.ctx.state.selectedSlotId] = { id: resp?.id, groups: sel, by };
          await this.ctx.onRepaint?.();
          this.close();
        }catch(err){ alert(err.message || 'Ошибка сохранения'); }
      };

      // Сохранить СЕРИЮ (долгосрочно)
      if (this.saveSeriesBtn){
        this.saveSeriesBtn.onclick = async ()=>{
          const classroomId = Number(el.dataset.classroomId);
          if (!classroomId) return alert('Не найден ID аудитории');

          const sel = this.getSelectedFromBoxes();
          if (!sel.length) return alert('Выберите группу для серии');
          const groupId = sel[0].id; // берём первую отмеченную

          const sched = buildSchedulePayload(this.ctx);
          const payload = {
            classroomId,
            groupId,
            timezone: sched.timezone || 'UTC',
            floor: Number(sched.floor ?? getActiveFloor()),
            dayOfWeek: Number(sched.dayOfWeek || 1),
            scheduleType: (sched.scheduleType === 'PARITY') ? 'PARITY' : 'WEEKLY',
            weekType: (sched.scheduleType === 'PARITY') ? (sched.weekType || 'EVEN') : 'STABLE'
          };

          // помогаем себе в логах браузера
          console.log('[booking-series] payload ->', payload);

          try{
            const dto = await this.apiCreateSeries(payload);
            alert(`Серия создана (id=${dto.id})`);
          }catch(err){
            alert(err?.message || 'Ошибка создания серии');
          }
        };
      }

      // Снять бронь
      this.clearBtn.onclick = async ()=>{
        const classroomId = Number(el.dataset.classroomId);
        const rb = this.ctx.state.roomBookings[name]?.[this.ctx.state.selectedSlotId];
        try{
          if (rb?.id && await this.apiDeleteBookingById(rb.id)){
            // ok
          }else{
            await this.apiDeleteBookingByKey({
              date: this.ctx.state.selectedDate,
              slotId: Number(this.ctx.state.selectedSlotId),
              classroomId
            });
          }
          if (this.ctx.state.roomBookings[name])
            delete this.ctx.state.roomBookings[name][this.ctx.state.selectedSlotId];
          await this.ctx.onRepaint?.();
          this.close();
        }catch(err){ alert(err.message || 'Ошибка удаления'); }
      };

      // Сохранить свойства кабинета
      this.saveMetaBtn.onclick = async ()=>{
        const classroomId = Number(this.currentRoomEl?.dataset?.classroomId);
        if (!classroomId) return alert('Не найден ID аудитории');
        const payload = this.collectRoomForm();
        try{
          const updated = await this.apiUpdateClassroom(classroomId, payload);
          this.currentRoomEl.dataset.capacity = String(updated.capacity ?? 0);
          const base = this.currentRoomEl.textContent.replace(/\s*\(\d+\)\s*$/,'');
          this.currentRoomEl.textContent = `${base} (${updated.capacity ?? 0})`;
          this.dCapLbl.textContent = updated.capacity ?? 0;

          this.ctx.state.CLASSROOM_META.set(String(updated.id), {
            id: updated.id,
            facultyIds: (updated.facultyIds||payload.facultyIds||[]).map(Number),
            specializationIds: (updated.specializationIds||payload.specializationIds||[]).map(Number)
          });

          await this.ctx.onRepaint?.();
          alert('Кабинет сохранён');
        }catch(e){
          alert(e?.message || 'Не удалось сохранить кабинет');
        }
      };
    }

    close(){
      this.overlay.classList.remove('open');
      this.drawer.classList.remove('open');
      this.drawer.setAttribute('aria-hidden','true');
      const sel = document.querySelector('.room.selected');
      if (sel) sel.classList.remove('selected');
      this.currentRoomEl=null;
      try{ this.ctx.onClose?.(); }catch{}
    }
  }

  window.RoomDrawer = RoomDrawer;
})();

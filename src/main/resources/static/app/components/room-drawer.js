(function () {
  function getCookie(name) {
    return document.cookie.split("; ").find(r => r.startsWith(name + "="))?.split("=")[1];
  }
  function decode(s){ try { return decodeURIComponent(s); } catch { return s; } }
  const csrfToken = decode(getCookie("XSRF-TOKEN") || "");
  const csrfHeader = csrfToken ? {"X-CSRF-TOKEN": csrfToken} : {};

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function sumSize(groups){ return groups.reduce((a,g)=>a + (Number(g.size)||0), 0); }

  class RoomDrawer {
    constructor(opts){
      this.overlay   = document.getElementById(opts.overlayId || 'overlay');
      this.drawer    = document.getElementById(opts.drawerId  || 'drawer');
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
      this.saveMetaBtn = document.getElementById('save-room-meta');

      // поля свойств
      this.selBuilding = document.getElementById('c-building');
      this.selFaculty  = document.getElementById('c-faculty');
      this.selSpec     = document.getElementById('c-spec');

      this.currentEl = null;
      this.context = null;

      this.overlay.addEventListener('click', ()=>this.close());
      this.dClose .addEventListener('click', ()=>this.close());
    }

    setContext(ctx){ this.context = ctx; }

    // --- API ---
    async apiEnsureClassroom(name, capacity){
      const r = await fetch('/api/classrooms/ensure', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json', ...csrfHeader},
        body: JSON.stringify({ name, capacity })
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    }
    async apiGetClassroom(id){
      const r = await fetch(`/api/classrooms/${id}`, {credentials:'same-origin'});
      if (!r.ok) throw new Error('Не удалось загрузить кабинет');
      return await r.json();
    }
    async apiUpdateClassroom(id, payload){
      const r = await fetch(`/api/classrooms/${id}`, {
        method:'PUT', credentials:'same-origin',
        headers:{'Content-Type':'application/json', ...csrfHeader},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    }
    async apiCreateBooking(payload){
      const r = await fetch('/api/bookings', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json', ...csrfHeader},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    }
    async apiDeleteBookingById(id){
      const r = await fetch(`/api/bookings/${id}`, {method:'DELETE', credentials:'same-origin', headers:{...csrfHeader}});
      return r.ok;
    }
    async apiDeleteBookingByKey({date, slotId, classroomId}){
      const url = `/api/bookings/by-key?date=${encodeURIComponent(date)}&slotId=${slotId}&classroomId=${classroomId}`;
      const r = await fetch(url, {method:'DELETE', credentials:'same-origin', headers:{...csrfHeader}});
      if (!r.ok && r.status !== 404) throw new Error(await r.text());
    }

    // --- UI helpers ---
    renderGroupsSelector(allGroups, selected){
      this.groupsBox.innerHTML = '';
      const selIds = new Set(selected.map(g=>g.id));
      allGroups.forEach(g=>{
        const row = document.createElement('label');
        row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
        row.innerHTML = `<input type="checkbox" value="${g.id}" ${selIds.has(g.id)?'checked':''} aria-label="Выбрать группу ${escapeHtml(g.name)}">
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
                         <button type="button" data-x="${g.id}" aria-label="Убрать ${escapeHtml(g.name)}" style="margin-left:6px;border:none;background:transparent;cursor:pointer">✕</button>`;
        this.chips.appendChild(div);
      });
    }
    calcAndPaintUsage(cap, selected){
      const used = sumSize(selected);
      this.usageLine.textContent = `${used} / ${cap}`;
    }
    getSelectedFromBoxes(allGroups){
      const checked = [...this.groupsBox.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>Number(cb.value));
      const map = new Map(allGroups.map(g=>[g.id,g]));
      return checked.map(id=>map.get(id)).filter(Boolean);
    }

    // === СВОЙСТВА КАБИНЕТА ===
    fillRoomForm(dto, presets){
      // capacity
      document.getElementById('c-cap').value = dto.capacity ?? 0;

      // building
      this.selBuilding.innerHTML =
        '<option value="">— не выбрано —</option>' +
        (presets.buildings||[]).map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
      this.selBuilding.value = dto.buildingId ?? '';

      // FACULTY: single-select
      this.selFaculty.innerHTML =
        '<option value="">— не выбрано —</option>' +
        (presets.faculties||[]).map(f=>`<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
      const firstFacultyId = (dto.facultyIds && dto.facultyIds.length) ? Number(dto.facultyIds[0]) : '';
      this.selFaculty.value = firstFacultyId || '';

      // SPEC: single-select
      this.selSpec.innerHTML =
        '<option value="">— не выбрано —</option>' +
        (presets.specs||[]).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      const firstSpecId = (dto.specializationIds && dto.specializationIds.length) ? Number(dto.specializationIds[0]) : '';
      this.selSpec.value = firstSpecId || '';
    }

    collectRoomForm(){
      const cap = Number(document.getElementById('c-cap').value || 0);

      const buildingId = this.selBuilding.value ? Number(this.selBuilding.value) : null;

      const facultyId = this.selFaculty.value ? Number(this.selFaculty.value) : null;
      const specId    = this.selSpec.value ? Number(this.selSpec.value) : null;

      // на бэк отдадим как массивы (совместимо с текущим API)
      const facultyIds = facultyId ? [facultyId] : [];
      const specializationIds = specId ? [specId] : [];

      return { capacity: cap, buildingId, facultyIds, specializationIds };
    }

    open(el){
      if (!this.context) throw new Error('RoomDrawer: context not set');
      if (!el || el.classList.contains('foyer')) return;

      this.currentEl = el;

      const {state} = this.context;
      const name = el.dataset.room;
      const cap  = Number(el.dataset.capacity || 0);
      const slotObj = (state.SLOT_LIST || []).find(s=>s.id===Number(state.selectedSlotId));

      this.dRoom.textContent = name;
      this.dCapLbl.textContent  = cap;
      this.dSlot.textContent = slotObj ? `${slotObj.from ?? ''}–${slotObj.to ?? ''}` : String(state.selectedSlotId);

      const rb = state.roomBookings[name]?.[state.selectedSlotId] || null;
      this.dBy.textContent = rb?.by || '—';

      const selected = rb ? [...rb.groups] : [];
      this.renderGroupsSelector(state.ALL_GROUPS, selected);
      this.renderCurrentChips(selected);
      this.calcAndPaintUsage(cap, selected);

      this.overlay.classList.add('open');
      this.drawer.classList.add('open');
      this.drawer.setAttribute('aria-hidden','false');

      // ensure classroom id + метаданные
      (async ()=>{
        if (!el.dataset.classroomId){
          try{
            const dto = await this.apiEnsureClassroom(name, cap);
            el.dataset.classroomId = String(dto.id);
            el.dataset.capacity = String(dto.capacity ?? cap);
            const base = el.textContent.replace(/\s*\(\d+\)\s*$/,'');
            el.textContent = `${base} (${dto.capacity ?? cap})`;
            state.CLASSROOMS.set(name, {id:dto.id, name, capacity: dto.capacity ?? cap});
          }catch(e){ console.warn('ensure classroom failed', e); }
        }
        if (el.dataset.classroomId){
          try{
            const meta = await this.apiGetClassroom(Number(el.dataset.classroomId));
            this.fillRoomForm(meta, state.PRESETS);
          }catch{/* ignore */}
        }
      })();

      // chips/remove
      this.chips.onclick = (e)=>{
        const id = Number(e.target?.dataset?.x);
        if (!id) return;
        this.groupsBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{ if (Number(cb.value)===id) cb.checked = false; });
        const ns = this.getSelectedFromBoxes(state.ALL_GROUPS); this.renderCurrentChips(ns); this.calcAndPaintUsage(cap, ns);
      };
      this.groupsBox.onchange = ()=>{
        const ns = this.getSelectedFromBoxes(state.ALL_GROUPS); this.renderCurrentChips(ns); this.calcAndPaintUsage(cap, ns);
      };

      // сохранить бронирование
      this.saveBtn.onclick = async ()=>{
        const sel = this.getSelectedFromBoxes(state.ALL_GROUPS);
        const classroomId = Number(el.dataset.classroomId);
        if (!classroomId) { alert('Не найден ID аудитории.'); return; }
        try{
          const resp = await this.apiCreateBooking({
            date: state.selectedDate,
            slotId: Number(state.selectedSlotId),
            classroomId,
            groupIds: sel.map(g=>g.id)
          });
          const by = state.ME.login || resp?.bookedBy || '—';
          if (!state.roomBookings[name]) state.roomBookings[name] = {};
          state.roomBookings[name][state.selectedSlotId] = { id: resp?.id, groups: sel, by };
          await this.context.onRepaint();
          this.close();
        }catch(err){ alert(err.message || 'Ошибка сохранения'); }
      };

      // снять бронь
      this.clearBtn.onclick = async ()=>{
        const classroomId = Number(el.dataset.classroomId);
        const rb = state.roomBookings[name]?.[state.selectedSlotId];
        try{
          if (rb?.id && await this.apiDeleteBookingById(rb.id)){
            // ok
          }else{
            await this.apiDeleteBookingByKey({date: state.selectedDate, slotId: Number(state.selectedSlotId), classroomId});
          }
          if (state.roomBookings[name]) delete state.roomBookings[name][state.selectedSlotId];
          await this.context.onRepaint();
          this.close();
        }catch(err){ alert(err.message || 'Ошибка удаления'); }
      };

      // сохранить свойства кабинета
      this.saveMetaBtn.onclick = async ()=>{
        const classroomId = Number(this.currentEl?.dataset?.classroomId);
        if (!classroomId) return alert('Не найден ID аудитории');
        const payload = this.collectRoomForm();
        try{
          const updated = await this.apiUpdateClassroom(classroomId, payload);
          this.currentEl.dataset.capacity = String(updated.capacity ?? 0);
          const base = this.currentEl.textContent.replace(/\s*\(\d+\)\s*$/,'');
          this.currentEl.textContent = `${base} (${updated.capacity ?? 0})`;
          this.dCapLbl.textContent = updated.capacity ?? 0;
          this.context.state.CLASSROOMS.set(updated.name, { id: updated.id, name: updated.name, capacity: updated.capacity ?? 0 });
          await this.context.onRepaint();
          alert('Кабинет сохранён');
        }catch(e){ alert(e?.message || 'Не удалось сохранить кабинет'); }
      };
    }

    close(){
      this.overlay.classList.remove('open');
      this.drawer.classList.remove('open');
      this.drawer.setAttribute('aria-hidden','true');
      this.currentEl = null;
    }
  }

  window.RoomDrawer = RoomDrawer;
})();

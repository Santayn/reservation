// ----- helpers -----
export function qs(s){ return document.querySelector(s); }
export function qsa(s){ return Array.from(document.querySelectorAll(s)); }
export function show(el){ el.classList.remove('hidden'); }
export function hide(el){ el.classList.add('hidden'); }

export function toastOK(el,msg){ el.textContent=msg; el.classList.remove('hidden'); el.classList.add('ok'); setTimeout(()=>hide(el),3000); }
export function toastErr(el,msg){ el.textContent=msg; el.classList.remove('hidden'); el.classList.add('error'); }
export function clearAlerts(){ qsa('.alert').forEach(hide); }

export async function jfetch(url, options={}){
  const opt = Object.assign({ headers:{'Content-Type':'application/json'} }, options);
  const res = await fetch(url, opt);
  if (!res.ok){
    let body = '';
    try{ const j = await res.json(); body = (j.error||j.message)||JSON.stringify(j); }catch{}
    throw new Error(`${res.status} ${res.statusText}${body?': '+body:''}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ----- sidebar injection -----
export async function injectSidebar(activePage){
  const el = document.getElementById('sidebar');
  if (!el) return;
  const html = await fetch('/cabinet/partials/sidebar.html', { credentials:'same-origin' }).then(r=>r.text());
  el.innerHTML = html;
  const a = el.querySelector(`[data-page="${activePage}"]`);
  if (a) a.classList.add('active');
}

// ====== Specializations API ======
export async function listSpecializations(){
  return jfetch('/api/specializations', { credentials:'same-origin' });
}
export async function createSpecialization(name){
  return jfetch('/api/specializations', {
    credentials:'same-origin',
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name })
  });
}
export async function deleteSpecialization(id){
  return jfetch(`/api/specializations/${id}`, {
    credentials:'same-origin',
    method:'DELETE'
  });
}

// ====== Buildings API ======
export async function listBuildings(){
  return jfetch('/api/buildings', { credentials:'same-origin' });
}
export async function createBuilding(name){
  return jfetch('/api/buildings', {
    credentials:'same-origin',
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name })
  });
}
export async function deleteBuilding(id){
  return jfetch(`/api/buildings/${id}`, {
    credentials:'same-origin',
    method:'DELETE'
  });
}

// ====== Schedule Slots API (UI -> HH:mm) ======
const toIsoTime = (hhmm) => {
  const t = String(hhmm || '').trim();
  if (!/^\d{2}:\d{2}$/.test(t)) throw new Error('Неверный формат времени (HH:mm)');
  return `1970-01-01T${t}:00`;
};

export async function listSlots(){
  // поддерживаем как массив, так и {content:[...]}
  const data = await jfetch('/api/schedule/slots', { credentials:'same-origin' });
  return Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : []);
}

export async function createSlot(startHHMM, endHHMM){
  const body = { startAt: toIsoTime(startHHMM), endAt: toIsoTime(endHHMM) };
  return jfetch('/api/schedule/slots', {
    credentials:'same-origin',
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
}

export async function deleteSlot(id){
  return jfetch(`/api/schedule/slots/${id}`, {
    credentials:'same-origin',
    method:'DELETE'
  });
}

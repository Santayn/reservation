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
  const html = await fetch('/cabinet/partials/sidebar.html').then(r=>r.text());
  el.innerHTML = html;
  const a = el.querySelector(`[data-page="${activePage}"]`);
  if (a) a.classList.add('active');
}

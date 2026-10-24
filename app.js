/* Armazón: estado en memoria, navegación, bloqueo automático y pantallas de acceso. */
(function (root) {
'use strict';
const C = root.Core, V = root.Vault, UI = root.UI, h = UI.h;
const App = { S: null, ui: {}, screen: 'inicio', params: {}, screens: {}, banner: false, lockMs: null };
root.App = App;

const TABS = [['inicio', 'Inicio', '⌂'], ['rendicion', 'Rendición', '✎'], ['colocaciones', 'Colocaciones', '☰'], ['vencimientos', 'Vencimientos', '▦'], ['calculadora', 'Calculadora', '∑']];
let lastKey = '', idleT = null, bgT = null, hiddenAt = null;

App.rootEl = () => document.getElementById('root');
App.hoy = () => C.today();
App.rend = (col) => App.S.rends.find((r) => r.id === col.rend);
App.colorOf = (col) => { const r = App.rend(col); return r ? r.color : 0; };
App.titulo = (col) => 'N° ' + col.n + (col.alias ? ' · ' + col.alias : '');
App.times = () => App.lockMs || { bg: (App.S ? App.S.cfg.lockBg : 2) * 60000, idle: (App.S ? App.S.cfg.lockIdle : 5) * 60000 };
App.setLockMs = (o) => { App.lockMs = o; App.resetIdle(); };

App.commit = async function (noRender) {
  try { await V.save(App.S); } catch (e) { UI.toast('No se pudo guardar. Revisá el almacenamiento del teléfono.'); }
  if (!noRender) App.render();
};
App.go = function (screen, params) {
  if (screen !== 'config') App.ui.draft = null;
  App.screen = screen; App.params = params || {};
  App.render();
};

/* ---------- vista general ---------- */
App.bannerNode = function () {
  if (!App.banner || !App.S) return null;
  const hoy = App.hoy(), m = C.addDays(hoy, 1);
  const cur = C.enCurso(App.S);
  const a = cur.filter((c) => c.cob === hoy), b = cur.filter((c) => c.cob === m), v = cur.filter((c) => c.cob < hoy);
  if (!a.length && !b.length && !v.length) return null;
  const parts = [];
  if (a.length) parts.push('Hoy: filas ' + C.listaN(a));
  if (b.length) parts.push('Mañana: filas ' + C.listaN(b));
  if (v.length) parts.push('Vencidas sin cobrar: filas ' + C.listaN(v));
  return h('div', { class: 'alert ' + (v.length ? 'bad' : 'warn') + ' banner', role: 'alert' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, parts.join(' · ')),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { App.banner = false; App.render(); } }, 'Cerrar')));
};
App.render = function () {
  const R = App.rootEl();
  if (!App.S) return;
  const def = App.screens[App.screen] || App.screens.inicio;
  const out = def(App.params || {});
  const key = App.screen + JSON.stringify(App.params || {});
  const y = key === lastKey ? window.scrollY : 0;
  lastKey = key;
  const tabFor = TABS.some((t) => t[0] === App.screen) ? App.screen : null;
  const kids = [
    h('div', { class: 'top' },
      out.back ? h('button', { type: 'button', class: 'back', 'aria-label': 'Volver', onclick: () => App.go(out.back, out.backParams) }, '←') : null,
      h('h1', null, out.title)),
    App.bannerNode(),
    h('main', { class: out.bar ? 'conbarra' : '' }, out.body),
    out.bar ? h('div', { class: 'fixbar' }, h('div', { class: 'in' }, out.bar)) : null,
    out.nonav ? null : h('nav', { class: 'tabs' }, TABS.map((t) => h('button', { type: 'button', class: tabFor === t[0] ? 'on' : '', onclick: () => App.go(t[0]) }, h('span', { class: 'ic' }, t[2]), t[1])))
  ];
  R.replaceChildren.apply(R, kids.filter(Boolean));
  window.scrollTo(0, y);
};

/* ---------- bloqueo ---------- */
App.resetIdle = function () {
  clearTimeout(idleT);
  if (App.S) idleT = setTimeout(App.lockNow, App.times().idle);
};
App.lockNow = function () {
  clearTimeout(idleT); clearTimeout(bgT); hiddenAt = null;
  V.lock();
  App.S = null; App.ui = {}; App.banner = false; lastKey = '';
  UI.closeAllModals();
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  App.rootEl().replaceChildren();
  if (V.exists()) App.showLock(); else App.showCreate();
};
function goHidden() {
  if (!App.S) return;
  hiddenAt = Date.now();
  clearTimeout(bgT);
  bgT = setTimeout(App.lockNow, App.times().bg);
}
function goVisible() {
  clearTimeout(bgT);
  if (!App.S) { hiddenAt = null; return; }
  if (hiddenAt != null && Date.now() - hiddenAt >= App.times().bg) { App.lockNow(); return; }
  hiddenAt = null;
  App.banner = true; App.resetIdle(); App.render();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) goHidden(); else goVisible(); });
window.addEventListener('pagehide', goHidden);
window.addEventListener('pageshow', (e) => { if (e.persisted) goVisible(); });
['pointerdown', 'keydown', 'touchstart', 'input'].forEach((ev) => document.addEventListener(ev, () => App.resetIdle(), { passive: true, capture: true }));

App.start = function (state) {
  App.S = state; App.ui = {}; App.banner = true; lastKey = '';
  App.screen = state.cfg.ok ? 'inicio' : 'inicial'; App.params = {};
  App.resetIdle();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  App.render();
};

/* ---------- pantallas de acceso (no muestran ningún dato) ---------- */
function wrap(kids) { App.rootEl().replaceChildren(h('div', { class: 'lockwrap' }, kids)); }

App.showUnsupported = function () {
  wrap([h('h1', null, 'Colocaciones'),
    h('div', { class: 'alert bad' }, 'Este navegador no permite cifrar datos en este contexto (falta crypto.subtle). Abrí la aplicación desde una dirección https o desde localhost, no como archivo local. Mientras tanto no se guarda nada.')]);
};

App.showLock = function () {
  const pw = UI.pw('Contraseña');
  const msg = h('div', { class: 'alert bad hide', role: 'alert' });
  let fails = 0, until = 0, timer = null;
  const go = UI.btn('Desbloquear', 'pri full', async () => {
    if (Date.now() < until) return;
    const val = pw.input.value;
    if (!val) return;
    go.disabled = true;
    try {
      const st = await V.unlock(val);
      pw.input.value = '';
      clearInterval(timer);
      App.start(st);
    } catch (e) {
      fails++;
      const wait = Math.min(60, Math.pow(2, fails - 1));
      until = Date.now() + wait * 1000;
      msg.classList.remove('hide');
      const tick = () => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0) { clearInterval(timer); go.disabled = false; msg.textContent = 'Contraseña incorrecta'; return; }
        msg.textContent = 'Contraseña incorrecta. Esperá ' + left + ' s para volver a probar.';
      };
      clearInterval(timer); tick(); timer = setInterval(tick, 500);
      pw.input.value = ''; pw.input.focus();
    }
    if (Date.now() >= until) go.disabled = false;
  });
  pw.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  wrap([h('h1', null, 'Colocaciones'), h('p', { class: 'mut' }, 'Ingresá tu contraseña para desbloquear.'), pw.wrap, msg, h('div', { style: null }, go)]);
  pw.input.focus();
};

App.showCreate = function () {
  if (!V.supported()) { App.showUnsupported(); return; }
  const p1 = UI.pw('Contraseña (mínimo 6 caracteres)'), p2 = UI.pw('Repetir contraseña');
  const aviso = h('div', { class: 'alert warn hide' }, 'Un PIN numérico corto es débil si alguien copia los datos del teléfono. Se recomienda una frase de 10 o más caracteres.');
  const err = h('div', { class: 'alert bad hide', role: 'alert' });
  const ok = h('input', { type: 'checkbox' });
  p1.input.addEventListener('input', () => { aviso.classList.toggle('hide', !/^\d+$/.test(p1.input.value)); });
  const go = UI.btn('Crear contraseña y empezar', 'pri full', async () => {
    err.classList.add('hide');
    const a = p1.input.value, b = p2.input.value;
    const fail = (t) => { err.textContent = t; err.classList.remove('hide'); };
    if (a.length < 6) return fail('La contraseña debe tener al menos 6 caracteres.');
    if (a !== b) return fail('Las contraseñas no coinciden.');
    if (!ok.checked) return fail('Tenés que confirmar que entendés que no se puede recuperar.');
    go.disabled = true;
    try {
      const st = C.newState();
      await V.create(a, st);
      p1.input.value = ''; p2.input.value = '';
      App.start(st);
    } catch (e) { fail('No se pudo crear el almacenamiento cifrado.'); go.disabled = false; }
  });
  wrap([h('h1', null, 'Colocaciones'),
    h('p', null, 'Primera vez: creá una contraseña. Todo lo que cargues se guarda cifrado en este teléfono y no sale de él.'),
    h('p', { class: 'mut' }, 'Se recomienda una frase de 10 o más caracteres.'),
    p1.wrap, aviso, h('div', { style: null }, p2.wrap),
    h('div', { class: 'alert warn' }, 'Si olvidás la contraseña, los datos no se pueden recuperar. Nadie puede recuperarlos.'),
    h('label', { class: 'chk' }, ok, 'Entiendo que no hay forma de recuperarla.'), err, go]);
};

/* ---------- utilidades compartidas por las pantallas ---------- */
App.stat = (k, v, cls, fn) => h(fn ? 'button' : 'div', { class: 'stat ' + (cls || '') + (fn ? ' tap' : ''), type: fn ? 'button' : null, onclick: fn, style: null }, h('div', { class: 'k' }, k), h('div', { class: 'v num' }, v));
App.colorName = (i) => C.COLORES[i].n;
App.colorChip = (i) => h('span', { class: 'dot c' + i });
App.estadoCol = function (col) {
  if (col.estado === 'Cobrada') return { txt: 'Cobrada el ' + C.fmtDate(col.cobReal), cls: 'ok' };
  const d = C.diffDays(col.cob, App.hoy());
  if (d < 0) return { txt: C.diasTxt(d) + ', falta cobrar', cls: 'bad' };
  return { txt: C.diasTxt(d), cls: d <= 3 ? 'warn' : '' };
};

App.destroyAndReset = async function () {
  await V.destroyAll();
  clearTimeout(idleT); clearTimeout(bgT);
  App.S = null; App.ui = {}; App.banner = false; lastKey = '';
  UI.closeAllModals();
  App.rootEl().replaceChildren();
  App.showCreate();
  const list = h('div', { class: 'alert info', role: 'status' },
    h('strong', null, 'Los datos de la aplicación se destruyeron. Quedan fuera de la aplicación y hay que borrarlos a mano:'),
    h('ul', null,
      h('li', null, 'Archivos de respaldo (carpeta Descargas, Drive, WhatsApp, correo).'),
      h('li', null, 'Eventos importados al calendario.'),
      h('li', null, 'Fotos del cuaderno y conversaciones con una IA donde se hayan enviado.'),
      h('li', null, 'El ícono de la pantalla de inicio (desinstalar la app).')),
    UI.btn('Entendido', 'ghost sm', (e) => e.target.closest('.alert').remove()));
  const w = document.querySelector('.lockwrap');
  if (w) w.insertBefore(list, w.firstChild);
};
})(window);

/* Ayudas de interfaz. Nunca se arma HTML con texto del usuario: todo entra como nodo de texto. */
(function (root) {
'use strict';
const UI = {};
const SVGNS = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/'); // identificador de espacio de nombres, no una conexión

function addKids(el, kids) {
  kids.forEach((k) => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) addKids(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  });
}
function setProps(el, props) {
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (v == null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
}
UI.h = function (tag, props) {
  const el = document.createElement(tag);
  setProps(el, props);
  addKids(el, Array.prototype.slice.call(arguments, 2));
  return el;
};
UI.svg = function (tag, props) {
  const el = document.createElementNS(SVGNS, tag);
  Object.keys(props || {}).forEach((k) => { if (props[k] != null) el.setAttribute(k, props[k]); });
  addKids(el, Array.prototype.slice.call(arguments, 2));
  return el;
};
const h = UI.h;
UI.btn = (text, cls, fn, extra) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: fn }, extra || {}), text);
UI.field = (label, input, hint) => h('div', null, h('label', { class: 'f' }, label), input, hint ? h('div', { class: 'mut small' }, hint) : null);
UI.num = function (value, opts) {
  opts = opts || {};
  const inp = h('input', { type: 'text', inputmode: opts.int ? 'numeric' : 'decimal', autocomplete: 'off', value: value == null ? '' : String(value), placeholder: opts.ph || '' });
  if (opts.fmt !== false) inp.addEventListener('blur', () => {
    const v = root.Core.parseNum(inp.value);
    if (isFinite(v) && inp.value.trim() !== '') inp.value = root.Core.fmt(v, opts.int ? 0 : (Math.floor(v) === v ? 0 : 2));
  });
  return inp;
};
UI.sel = function (opts, value, onchange) {
  const s = h('select', { onchange }, opts.map((o) => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return h('option', { value: v, selected: String(v) === String(value) }, t); }));
  s.value = value;
  return s;
};
UI.pw = function (ph) {
  const input = h('input', { type: 'password', autocomplete: 'off', placeholder: ph || '', autocapitalize: 'off', spellcheck: 'false' });
  const tg = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; tg.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar'; } }, 'Mostrar');
  return { wrap: h('div', { class: 'pw' }, input, tg), input };
};
UI.modal = function (build) {
  const bg = h('div', { class: 'modalbg' });
  const box = h('div', { class: 'modal', role: 'dialog' });
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  addKids(box, [build(close)]);
  bg.appendChild(box);
  document.body.appendChild(bg);
  document.addEventListener('keydown', esc);
  return { close, box };
};
UI.closeAllModals = () => document.querySelectorAll('.modalbg').forEach((m) => m.remove());
UI.confirm = (msg, o) => new Promise((res) => {
  o = o || {};
  UI.modal((close) => h('div', null,
    o.title ? h('h2', null, o.title) : null,
    h('p', null, msg),
    h('div', { class: 'grid2' },
      UI.btn('Cancelar', 'ghost', () => { close(); res(false); }),
      UI.btn(o.ok || 'Aceptar', o.danger ? 'bad' : 'pri', () => { close(); res(true); }))));
});
UI.alert = (msg, title) => new Promise((res) => {
  UI.modal((close) => h('div', null, title ? h('h2', null, title) : null, h('p', { class: 'pre' }, msg), UI.btn('Entendido', 'pri full', () => { close(); res(); })));
});
let toastT = null;
UI.toast = function (msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3500);
};
UI.copy = async function (text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* alternativa */ }
  const ta = h('textarea', { 'aria-hidden': 'true' }); ta.value = text; document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove(); return ok;
};
/* Menú de compartir del teléfono; si no existe, descarga. */
UI.share = async function (name, mime, text) {
  const file = new File([text], name, { type: mime });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return 'compartido'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descargado';
};
UI.readFile = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsText(file); });
UI.stamp = () => { const t = root.Core.today().replace(/-/g, ''); return t; };

root.UI = UI;
})(window);

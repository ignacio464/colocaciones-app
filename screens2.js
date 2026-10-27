/* Pantallas: Rendición (carga por lote), Colocaciones, Cobro y Vencimientos. */
(function (root) {
'use strict';
const C = root.Core, UI = root.UI, App = root.App, h = UI.h, $ = C.money;
const SC = App.screens;
const PLAZOS_RAPIDOS = [10, 15, 20, 30, 35];

function errBox(list) { return list && list.length ? h('div', { class: 'alert bad', role: 'alert' }, list.map((e) => h('div', null, e))) : null; }
function chips(list, value, pick) { return h('div', { class: 'chips' }, list.map((x) => h('button', { type: 'button', class: 'chip' + (String(x[0]) === String(value) ? ' on' : ''), onclick: () => pick(x[0]) }, x[1]))); }
const numStr = (v) => (v == null || !isFinite(v) ? '' : C.fmt(v, Math.floor(v) === v ? 0 : 2));
const dateInput = (iso) => h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'dd/mm/aaaa', value: iso ? C.fmtDate(iso) : '' });

/* =============== COBRO =============== */
App.openCobro = function (ids) {
  const S = App.S, r = C.resumenCobro(S, ids);
  if (!r.cols.length) { UI.toast('No hay colocaciones en curso para cobrar.'); return; }
  UI.modal((close) => {
    const fecha = dateInput(App.hoy()), err = h('div');
    const reinv = UI.num(numStr(r.reinv)), retiro = UI.num(numStr(r.retiro));
    reinv.addEventListener('input', () => { const v = C.parseNum(reinv.value); if (isFinite(v)) retiro.value = numStr(C.r2(r.neta - v)); });
    retiro.addEventListener('input', () => { const v = C.parseNum(retiro.value); if (isFinite(v)) reinv.value = numStr(C.r2(r.neta - v)); });
    const line = (k, v, b) => h('div', { class: 'row sp' }, h('span', null, k), h('span', { class: 'num', style: null }, b ? h('strong', null, v) : v));
    const box = h('div');
    const confirmar = async () => {
      const f = C.parseEntrega(fecha.value, App.hoy()), rv = C.parseNum(reinv.value), rt = C.parseNum(retiro.value);
      const es = [];
      if (!f) es.push('La fecha de cobro no es válida.');
      if (!isFinite(rv) || rv < 0) es.push('El monto a reinvertir no es válido.');
      if (!isFinite(rt) || rt < 0) es.push('El monto a retirar no es válido.');
      if (isFinite(rv) && isFinite(rt) && Math.abs(rv + rt - r.neta) > 0.5) es.push('Reinvertir + retirar debe dar la ganancia neta (' + $(r.neta) + ').');
      if (es.length) { err.replaceChildren(errBox(es)); return; }
      C.cobrar(S, r.cols.map((c) => c.id), f, rv);
      await App.commit();
      box.replaceChildren(h('div', null, h('div', { class: 'alert ok' }, h('strong', null, 'Cobro registrado.'), h('div', null, 'Ahora tenés ' + $(C.saldo(S)) + ' sin colocar.')),
        h('div', { class: 'grid2' }, UI.btn('Colocar ahora', 'pri', () => { close(); App.go('rendicion'); }), UI.btn('Cerrar', 'ghost', close))));
    };
    box.appendChild(h('div', null, h('h2', null, 'Cobrar ' + r.cant + (r.cant === 1 ? ' colocación' : ' colocaciones')),
      UI.field('Fecha de cobro', fecha),
      h('div', { class: 'card' },
        line('Capital recuperado', $(r.capital)), line('Total cobrado', $(r.total)), line('Ganancia bruta', $(r.bruta)),
        r.costo > 0 ? line('Costo de financiamiento', '−' + $(r.costo)) : null, line('Ganancia neta', $(r.neta), true),
        r.pagoFin > 0 ? line('A devolver al financista', $(r.pagoFin)) : null),
      UI.field('A reinvertir', reinv), UI.field('A retirar', retiro), err,
      h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', close), UI.btn('Confirmar cobro', 'pri', confirmar))));
    return box;
  });
};

/* =============== RENDICIÓN =============== */
function proximoColor() { return App.S.rends.length % 8; }
function initRend() {
  App.ui.rend = { fecha: App.hoy(), color: proximoColor(), nombre: '', origen: 'Propio', rows: [], preview: null, txt: '' };
}
function nextNForRows() {
  const rd = App.ui.rend;
  const mx = rd.rows.reduce((m, r) => { const n = C.parseInt(r.n); return isFinite(n) ? Math.max(m, n) : m; }, 0);
  return Math.max(C.nextN(App.S), mx + 1);
}
function newRow(from) {
  const rd = App.ui.rend;
  const r = { n: String(nextNForRows()), alias: '', cap: '', plazo: from ? from.plazo : '', ent: from ? from.ent : C.fmtDate(rd.fecha), cob: '', origen: from ? from.origen : rd.origen, total: '', manual: false, imported: false, marca: '', last: 'plazo', err: null, el: {} };
  if (from && from.last === 'cob') { r.cob = from.cob; r.last = 'cob'; }
  recalc(r, 'init');
  return r;
}
function setVal(r, k, v, skip) { r[k] = v; if (r.el[k] && k !== skip) r.el[k].value = v; }
function recalc(r, changed) {
  const cfg = App.S.cfg;
  const ent = C.parseEntrega(r.ent, App.hoy());
  if (changed === 'cob') r.last = 'cob'; else if (changed === 'plazo') r.last = 'plazo';
  const plz = C.parseInt(r.plazo);
  if (ent) {
    if (r.last === 'cob') {
      const cob = C.parseCobro(r.cob, ent);
      if (cob) { const d = C.diffDays(cob, ent); setVal(r, 'plazo', d >= 1 ? String(d) : '', changed); }
    } else if (plz >= 1) setVal(r, 'cob', C.fmtDate(C.addDays(ent, plz)), changed);
    else if (changed !== 'cob') setVal(r, 'cob', '', changed);
  }
  const cap = C.parseNum(r.cap), p = C.parseInt(r.plazo);
  if (r.imported) r.marca = 'importado';
  else if (r.manual) r.marca = 'manual';
  else if (cap > 0 && p >= 1) { const t = C.calcTotal(cfg, cap, p, r.origen); setVal(r, 'total', numStr(t.total), changed === 'total' ? 'total' : null); r.marca = t.marca; }
  else { setVal(r, 'total', '', changed); r.marca = ''; }
  paintRow(r);
}
function paintRow(r) {
  const el = r.el; if (!el.info) return;
  const cap = C.parseNum(r.cap), tot = C.parseNum(r.total), p = C.parseInt(r.plazo);
  el.marca.textContent = r.marca || '—'; el.marca.className = 'tag ' + (r.marca === 'manual' ? 'warn' : r.marca === 'importado' ? 'warn' : r.marca ? 'ok' : '');
  if (cap > 0 && tot >= 0 && p >= 1) {
    const gan = tot - cap, cf = r.origen === 'Financiado' ? C.costoFin(App.S.cfg, cap, p) : 0;
    el.info.textContent = 'Ganancia ' + $(gan) + ' · tasa mensual implícita ' + C.pct(gan / cap * 30 / p * 100) + (cf ? ' · costo ' + $(cf) + ' · neta ' + $(gan - cf) : '');
  } else el.info.textContent = 'Completá capital y plazo para ver la ganancia.';
  paintDup();
  el.card.className = 'rowcard c' + App.ui.rend.color + (r.err ? ' bad' : '');
  el.err.replaceChildren(r.err || '');
  el.err.classList.toggle('hide', !r.err);
}
function paintDup() {
  const rd = App.ui.rend, count = {};
  rd.rows.forEach((x) => { const n = C.parseInt(x.n); if (isFinite(n)) count[n] = (count[n] || 0) + 1; });
  rd.rows.forEach((x) => {
    if (!x.el.dup) return;
    const n = C.parseInt(x.n);
    const rep = isFinite(n) && (count[n] > 1 || App.S.cols.some((c) => c.n === n));
    x.el.dup.classList.toggle('hide', !rep);
  });
}
function updateFoot() {
  const rd = App.ui.rend; if (!rd.foot) return;
  let cant = 0, cap = 0, tot = 0;
  rd.rows.forEach((r) => { const c = C.parseNum(r.cap), t = C.parseNum(r.total); cant++; if (c > 0) cap += c; if (t > 0) tot += t; });
  rd.foot.textContent = cant + (cant === 1 ? ' fila' : ' filas') + ' · capital ' + $(cap) + ' · a devolver ' + $(tot) + ' · ganancia ' + $(tot - cap);
}
function rowNode(r, idx) {
  const rd = App.ui.rend, el = r.el = {};
  const inp = (k, o) => {
    const i = h('input', Object.assign({ type: 'text', autocomplete: 'off', value: r[k] }, o || {}));
    i.addEventListener('input', () => {
      r[k] = i.value;
      if (k === 'total') { r.manual = i.value.trim() !== ''; if (!r.manual) r.imported = false; recalc(r, 'total'); }
      else recalc(r, k);
      updateFoot();
    });
    el[k] = i; return i;
  };
  const origen = UI.sel(['Propio', 'Financiado'], r.origen, (e) => { r.origen = e.target.value; recalc(r, 'origen'); updateFoot(); });
  el.origen = origen;
  el.marca = h('span', { class: 'tag' }); el.info = h('div', { class: 'live' }); el.err = h('div', { class: 'alert bad hide', role: 'alert' });
  el.dup = h('span', { class: 'tag bad hide' }, 'N° repetido');
  el.card = h('div', { class: 'rowcard' });
  const quick = h('div', { class: 'chips' }, PLAZOS_RAPIDOS.map((d) => h('button', { type: 'button', class: 'chip', onclick: () => { r.plazo = String(d); el.plazo.value = r.plazo; recalc(r, 'plazo'); updateFoot(); } }, String(d))));
  el.card.append(
    h('div', { class: 'row sp' }, h('strong', null, 'Fila ' + (idx + 1)), el.dup,
      h('div', { class: 'row' },
        UI.btn('Duplicar', 'sm ghost', () => { const c = newRow(r); c.alias = r.alias; c.cap = r.cap; c.total = r.total; c.manual = r.manual; c.imported = r.imported; recalc(c, 'init'); rd.rows.splice(idx + 1, 0, c); App.render(); }),
        UI.btn('Borrar', 'sm ghost', () => { rd.rows.splice(idx, 1); if (!rd.rows.length) rd.rows.push(newRow()); App.render(); }))),
    h('div', { class: 'grid3' }, UI.field('N°', inp('n', { inputmode: 'numeric' })), UI.field('Alias (opcional)', inp('alias')), UI.field('Capital', inp('cap', { inputmode: 'decimal', placeholder: '$' }))),
    h('label', { class: 'f' }, 'Plazo (días)'), quick, inp('plazo', { inputmode: 'numeric', placeholder: 'días' }),
    h('div', { class: 'grid2' }, UI.field('Fecha de entrega', inp('ent', { inputmode: 'numeric', placeholder: 'dd/mm/aaaa' })), UI.field('Fecha de cobro', inp('cob', { inputmode: 'numeric', placeholder: 'dd/mm/aaaa' }))),
    h('div', { class: 'grid2' }, UI.field('Origen', origen), UI.field('Total a devolver', inp('total', { inputmode: 'decimal' }))),
    h('div', { class: 'row' }, h('span', { class: 'mut small' }, 'Marca:'), el.marca), el.info, el.err);
  paintRow(r);
  return el.card;
}

function isEmptyRow(r) { return !r.cap.trim() && !r.alias.trim() && !r.total.trim(); }
async function guardarRendicion() {
  const S = App.S, rd = App.ui.rend, hoy = App.hoy();
  const llenas = rd.rows.filter((x) => !isEmptyRow(x));
  if (llenas.length && llenas.length !== rd.rows.length) rd.rows = llenas; // se ignoran las filas totalmente vacías
  let first = null, nextAuto = nextNForRows();
  const filas = [], ns = [];
  rd.rows.forEach((r) => {
    r.err = null;
    const ent = C.parseEntrega(r.ent, hoy), cap = C.parseNum(r.cap), plazo = C.parseInt(r.plazo);
    const cob = ent && plazo >= 1 ? C.addDays(ent, plazo) : null;
    const total = C.parseNum(r.total);
    let n = r.n.trim() === '' ? null : C.parseInt(r.n);
    let msg = null;
    if (r.n.trim() !== '' && !(n >= 1)) msg = 'El N° debe ser un entero positivo.';
    else if (!(cap > 0)) msg = 'El capital debe ser mayor que 0.';
    else if (!(plazo >= 1)) msg = 'El plazo debe ser un número entero de días, 1 o más.';
    else if (!ent) msg = 'La fecha de entrega no es válida.';
    else if (!(total >= 0)) msg = 'Falta el total a devolver.';
    else if (total < cap) msg = 'El total a devolver no puede ser menor que el capital.';
    if (!msg) {
      if (n == null) { n = nextAuto++; }
      const f = { n, alias: r.alias.trim(), cap, ent, cob, plazo, origen: r.origen, total, marca: r.marca || 'manual' };
      msg = C.validarFila(f);
      if (!msg) { filas.push(f); ns.push(n); }
    }
    if (msg) { r.err = msg; if (!first) first = r; }
  });
  rd.rows.forEach(paintRow);
  if (first) { UI.toast('Hay filas con error: revisalas (marcadas en rojo). No se perdió nada.'); first.el.card.scrollIntoView({ block: 'center' }); return; }
  const dup = ns.filter((n, i) => ns.indexOf(n) !== i || S.cols.some((c) => c.n === n));
  if (dup.length && !(await UI.confirm('Se repiten estos N°: ' + Array.from(new Set(dup)).join(', ') + '. ¿Guardar igual?', { ok: 'Guardar igual' }))) return;
  C.addRend(S, { fecha: rd.fecha, color: rd.color, nombre: rd.nombre.trim() }, filas);
  await App.commit(true);
  initRend(); newRowInto();
  UI.toast('Rendición guardada: ' + filas.length + (filas.length === 1 ? ' colocación.' : ' colocaciones.'));
  App.go('colocaciones');
}
function newRowInto() { const rd = App.ui.rend; rd.rows.push(newRow(rd.rows[rd.rows.length - 1])); }

/* Importar pegando texto */
function parseImport(text, rd) {
  const S = App.S, out = [];
  const lastPlazo = (() => { for (let i = rd.rows.length - 1; i >= 0; i--) { const p = C.parseInt(rd.rows[i].plazo); if (p >= 1) return p; } return null; })();
  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const f = raw.split(/[;\t]/).map((x) => x.trim());
    const L = { linea: i + 1, raw, f, ok: false, motivo: '' };
    out.push(L);
    if (f.length < 3) { L.motivo = 'Faltan datos (se necesita al menos entrega, alias y monto).'; return; }
    const ent = C.parseEntrega(f[0], App.hoy());
    if (!ent) { L.motivo = 'Fecha de entrega imposible o mal escrita: "' + f[0] + '".'; return; }
    const cap = C.parseNum(f[2]);
    if (f[2] === '' || !(cap > 0)) { L.motivo = f[2] === '' ? 'Falta el monto.' : 'Monto inválido: "' + f[2] + '".'; return; }
    let origen = rd.origen;
    if (f[5]) { const o = f[5].toLowerCase(); if (o === 'p' || o === 'propio') origen = 'Propio'; else if (o === 'f' || o === 'financiado') origen = 'Financiado'; else { L.motivo = 'Origen no reconocido: "' + f[5] + '".'; return; } }
    let cob = null, plazo = null;
    if (f[4]) { cob = C.parseCobro(f[4], ent); if (!cob) { L.motivo = 'Fecha de cobro imposible o mal escrita: "' + f[4] + '".'; return; } plazo = C.diffDays(cob, ent); if (plazo < 1) { L.motivo = 'El cobro debe ser posterior a la entrega.'; return; } }
    else { if (!lastPlazo) { L.motivo = 'Falta la fecha de cobro y no hay un plazo de referencia en la grilla.'; return; } plazo = lastPlazo; cob = C.addDays(ent, plazo); }
    let total, marca, imported = false;
    if (f[3]) { total = C.parseNum(f[3]); if (!isFinite(total)) { L.motivo = 'Total a devolver inválido: "' + f[3] + '".'; return; } if (total < cap) { L.motivo = 'El total a devolver es menor que el capital.'; return; } marca = 'importado'; imported = true; }
    else { const t = C.calcTotal(S.cfg, cap, plazo, origen); total = t.total; marca = t.marca; }
    L.ok = true; L.row = { alias: f[1], cap, ent, cob, plazo, origen, total, marca, imported }; L.view = [C.fmtDate(ent), f[1], $(cap), $(total) + ' (' + marca + ')', C.fmtDate(cob), origen];
  });
  return out;
}

SC.rendicion = function () {
  const S = App.S;
  if (!App.ui.rend) { initRend(); }
  const rd = App.ui.rend;
  if (App.ui.rendPrefill) {
    const p = App.ui.rendPrefill; App.ui.rendPrefill = null;
    const r = newRow(rd.rows[rd.rows.length - 1]);
    r.cap = numStr(p.cap); r.plazo = String(p.plazo); r.origen = p.origen || r.origen; r.last = 'plazo';
    const prev = rd.rows[rd.rows.length - 1];
    if (prev && !prev.cap && !prev.alias) rd.rows.pop();
    recalc(r, 'plazo'); rd.rows.push(r);
  }
  if (!rd.rows.length) newRowInto();
  const colorPick = h('div', { class: 'chips' }, C.COLORES.map((c, i) => h('button', { type: 'button', class: 'chip' + (rd.color === i ? ' on' : ''), onclick: () => { rd.color = i; App.render(); } }, h('span', { class: 'dot c' + i }), c.n)));
  const fechaIn = dateInput(rd.fecha);
  fechaIn.addEventListener('change', () => {
    const f = C.parseEntrega(fechaIn.value, App.hoy()); if (!f) { UI.toast('La fecha de la rendición no es válida.'); return; }
    const old = C.fmtDate(rd.fecha); rd.fecha = f;
    rd.rows.forEach((r) => { if (r.ent === old) { r.ent = C.fmtDate(f); recalc(r, 'ent'); } });
    App.render();
  });
  const origenSel = UI.sel(['Propio', 'Financiado'], rd.origen, (e) => { rd.origen = e.target.value; });
  const nombre = h('input', { type: 'text', autocomplete: 'off', value: rd.nombre, oninput: (e) => { rd.nombre = e.target.value; } });
  const rowsBox = h('div', null, rd.rows.map((r, i) => rowNode(r, i)));
  rd.foot = h('div', { class: 'small num' });
  setTimeout(() => { updateFoot(); }, 0);
  // importar
  const ta = h('textarea', { placeholder: 'entrega;alias;monto;a devolver;cobro;origen\nUna colocación por línea. "a devolver", "cobro" y "origen" pueden quedar vacíos.', spellcheck: 'false', autocomplete: 'off' });
  ta.value = rd.txt || '';
  ta.addEventListener('input', () => { rd.txt = ta.value; });
  const prevBox = h('div');
  const drawPreview = () => {
    const pv = rd.preview; if (!pv) { prevBox.replaceChildren(); return; }
    const okN = pv.filter((l) => l.ok).length, bad = pv.length - okN;
    prevBox.replaceChildren(h('div', null,
      h('div', { class: 'tscroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Lín.', 'Entrega', 'Alias', 'Monto', 'A devolver', 'Cobro', 'Origen'].map((t) => h('th', null, t)))),
        h('tbody', null, pv.map((l) => [h('tr', { class: l.ok ? '' : 'hl' }, h('td', null, String(l.linea)), (l.ok ? l.view : [l.f[0] || '', l.f[1] || '', l.f[2] || '', l.f[3] || '', l.f[4] || '', l.f[5] || '']).map((v) => h('td', null, v))),
          l.ok ? null : h('tr', null, h('td', { colspan: 7 }, h('span', { class: 'tag bad' }, 'Inválida'), ' ' + l.motivo))])))),
      bad ? h('div', { class: 'alert warn' }, bad + (bad === 1 ? ' línea inválida no se va a agregar (ver el motivo arriba).' : ' líneas inválidas no se van a agregar (ver los motivos arriba).')) : null,
      okN ? UI.btn('Agregar ' + okN + (okN === 1 ? ' fila' : ' filas') + ' a la grilla', 'pri full', () => {
        rd.rows = rd.rows.filter((x) => !isEmptyRow(x)); // las filas vacías no cuentan ni para el N°
        pv.filter((l) => l.ok).forEach((l) => {
          const r = newRow(rd.rows[rd.rows.length - 1]);
          Object.assign(r, { alias: l.row.alias, cap: numStr(l.row.cap), plazo: String(l.row.plazo), ent: C.fmtDate(l.row.ent), cob: C.fmtDate(l.row.cob), origen: l.row.origen, total: numStr(l.row.total), imported: l.row.imported, manual: false, last: 'cob', marca: l.row.marca });
          rd.rows.push(r);
        });
        rd.preview = null; rd.txt = ''; UI.toast(okN + ' filas agregadas a la grilla.'); App.render();
      }) : h('div', { class: 'alert bad' }, 'No hay ninguna línea válida para agregar.')));
  };
  drawPreview();
  return {
    title: 'Rendición',
    body: h('div', null,
      h('div', { class: 'alert info' }, 'Saldo disponible para colocar: ', h('strong', null, $(C.saldo(S)))),
      h('div', { class: 'card' },
        UI.field('Fecha de la rendición (entrega por defecto)', fechaIn),
        h('label', { class: 'f' }, 'Color de la rendición'), colorPick,
        UI.field('Origen por defecto', origenSel), UI.field('Nombre (opcional)', nombre)),
      h('h2', null, 'Colocaciones'),
      rowsBox,
      UI.btn('+ Agregar fila', 'xl full', () => { rd.rows.push(newRow(rd.rows[rd.rows.length - 1])); App.render(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30); }),
      h('h2', null, 'Importar pegando texto'),
      ta, h('div', { style: null }, UI.btn('Ver vista previa', 'full', () => {
        if (!ta.value.trim()) { UI.toast('Pegá al menos una línea.'); return; }
        rd.preview = parseImport(ta.value, rd); drawPreview();
      })), prevBox),
    bar: h('div', null, rd.foot, h('div', { style: null }, UI.btn('Guardar rendición', 'pri full', guardarRendicion)))
  };
};

/* =============== COLOCACIONES =============== */
function cstate() {
  if (!App.ui.col) App.ui.col = { orden: 'n', sel: null, f: { estado: 'Todas', rend: '', origen: '', desde: '', hasta: '', atajo: '' }, rec: '' };
  return App.ui.col;
}
function filtrar(cs) {
  const hoy = App.hoy(), f = cstate().f;
  return cs.filter((c) => {
    if (f.estado === 'En curso' && c.estado !== 'En curso') return false;
    if (f.estado === 'Cobradas' && c.estado !== 'Cobrada') return false;
    if (f.estado === 'Vencidas' && !(c.estado === 'En curso' && c.cob < hoy)) return false;
    if (f.rend && String(c.rend) !== f.rend) return false;
    if (f.origen && c.origen !== f.origen) return false;
    if (f.desde && c.cob < f.desde) return false;
    if (f.hasta && c.cob > f.hasta) return false;
    return true;
  });
}
function openEdit(col) {
  const S = App.S, cobr = col.estado === 'Cobrada';
  UI.modal((close) => {
    const n = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: String(col.n) }), alias = h('input', { type: 'text', autocomplete: 'off', value: col.alias });
    const cap = UI.num(numStr(col.cap)), ent = dateInput(col.ent), cob = dateInput(col.cob), plazo = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: String(col.plazo) });
    const origen = UI.sel(['Propio', 'Financiado'], col.origen), total = UI.num(numStr(col.total));
    const marca = h('span', { class: 'tag' }, col.marca), err = h('div');
    let last = 'plazo', totalEdit = false, curMarca = col.marca;
    const refresh = (who) => {
      const e = C.parseEntrega(ent.value, App.hoy());
      if (who === 'cob') last = 'cob'; else if (who === 'plazo') last = 'plazo';
      if (e) {
        if (last === 'cob') { const c = C.parseCobro(cob.value, e); if (c && C.diffDays(c, e) >= 1) plazo.value = String(C.diffDays(c, e)); }
        else { const p = C.parseInt(plazo.value); if (p >= 1) cob.value = C.fmtDate(C.addDays(e, p)); }
      }
      if (who !== 'total' && !totalEdit && (curMarca === 'tabla' || curMarca === 'estimado')) {
        const c = C.parseNum(cap.value), p = C.parseInt(plazo.value);
        if (c > 0 && p >= 1) { const t = C.calcTotal(S.cfg, c, p, origen.value); total.value = numStr(t.total); curMarca = t.marca; marca.textContent = t.marca; }
      }
    };
    if (!cobr) {
      [cap, ent, plazo, origen].forEach((x) => x.addEventListener('input', () => refresh(x === plazo ? 'plazo' : x === ent ? 'ent' : 'x')));
      origen.addEventListener('change', () => refresh('x'));
      cob.addEventListener('input', () => refresh('cob'));
      total.addEventListener('input', () => { totalEdit = true; curMarca = 'manual'; marca.textContent = 'manual'; });
    }
    const save = async () => {
      const nn = C.parseInt(n.value);
      if (!(nn >= 1)) { err.replaceChildren(errBox(['El N° debe ser un entero positivo.'])); return; }
      if (S.cols.some((c) => c.id !== col.id && c.n === nn) && !(await UI.confirm('El N° ' + nn + ' ya existe. ¿Guardar igual?', { ok: 'Guardar igual' }))) return;
      let e;
      if (cobr) e = C.updateCol(S, col.id, { n: nn, alias: alias.value.trim() });
      else {
        const patch = { n: nn, alias: alias.value.trim(), cap: C.parseNum(cap.value), ent: C.parseEntrega(ent.value, App.hoy()), origen: origen.value };
        if (last === 'cob') patch.cob = C.parseCobro(cob.value, patch.ent); else patch.plazo = C.parseInt(plazo.value);
        if (totalEdit) patch.total = C.parseNum(total.value);
        if (!patch.ent) e = 'La fecha de entrega no es válida.';
        else if (last === 'cob' && !patch.cob) e = 'La fecha de cobro no es válida.';
        else e = C.updateCol(S, col.id, patch);
      }
      if (e) { err.replaceChildren(errBox([e])); return; }
      await App.commit(); close();
    };
    return h('div', null, h('h2', null, 'Editar ' + App.titulo(col)),
      cobr ? h('div', { class: 'alert info small' }, 'Es una colocación cobrada: solo se pueden cambiar el N° y el alias.') : null,
      h('div', { class: 'grid2' }, UI.field('N°', n), UI.field('Alias', alias)),
      cobr ? null : h('div', null, UI.field('Capital', cap), h('div', { class: 'grid2' }, UI.field('Fecha de entrega', ent), UI.field('Fecha de cobro', cob)),
        UI.field('Plazo (días)', plazo), UI.field('Origen', origen), UI.field('Total a devolver', total), h('div', { class: 'row' }, h('span', { class: 'mut small' }, 'Marca:'), marca)),
      err, h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', close), UI.btn('Guardar', 'pri', save)));
  });
}
async function borrarCol(col) {
  const extra = col.estado === 'Cobrada' ? ' Está cobrada: también se borran sus movimientos de Dinero.' : ' También se borran sus movimientos automáticos.';
  if (await UI.confirm('¿Eliminar ' + App.titulo(col) + ' (' + $(col.cap) + ')?' + extra, { ok: 'Eliminar', danger: true })) { C.deleteCol(App.S, col.id); await App.commit(); }
}
SC.colocaciones = function () {
  const S = App.S, st = cstate(), f = st.f, hoy = App.hoy();
  const all = S.cols.slice().sort(st.orden === 'n' ? (a, b) => a.n - b.n : (a, b) => (a.cob < b.cob ? -1 : a.cob > b.cob ? 1 : a.n - b.n));
  const list = filtrar(all);
  const sel = st.sel;
  const setF = (k, v) => { f[k] = v; f.atajo = ''; App.render(); };
  const atajo = (name, d, h2) => { f.estado = 'En curso'; f.desde = d; f.hasta = h2; f.atajo = name; App.render(); };
  const dIn = (k) => { const i = dateInput(f[k]); i.addEventListener('change', () => { const v = i.value.trim() === '' ? '' : C.parseEntrega(i.value, hoy); if (v === null) { UI.toast('Fecha inválida.'); return; } setF(k, v); }); return i; };
  const hastaIn = dateInput(f.atajo === 'fecha' ? f.hasta : '');
  hastaIn.addEventListener('change', () => { const v = C.parseEntrega(hastaIn.value, hoy); if (!v) { UI.toast('Fecha inválida.'); return; } f.estado = 'En curso'; f.desde = ''; f.hasta = v; f.atajo = 'fecha'; App.render(); });
  const filtros = h('div', { class: 'card' },
    h('div', { class: 'chips' },
      [['Vencen hoy', () => atajo('hoy', hoy, hoy)], ['Próximos 5 días', () => atajo('5', hoy, C.addDays(hoy, 5))], ['Próximos 10 días', () => atajo('10', hoy, C.addDays(hoy, 10))], ['Este mes', () => atajo('mes', hoy.slice(0, 8) + '01', C.endOfMonth(hoy))]]
        .map((a) => h('button', { type: 'button', class: 'chip' + (f.atajo === ({ 'Vencen hoy': 'hoy', 'Próximos 5 días': '5', 'Próximos 10 días': '10', 'Este mes': 'mes' })[a[0]] ? ' on' : ''), onclick: a[1] }, a[0]))),
    UI.field('Hasta una fecha que elijo', hastaIn),
    h('div', { class: 'grid2' }, UI.field('Estado', UI.sel(['Todas', 'En curso', 'Cobradas', 'Vencidas'], f.estado, (e) => setF('estado', e.target.value))),
      UI.field('Origen', UI.sel([['', 'Todos'], 'Propio', 'Financiado'], f.origen, (e) => setF('origen', e.target.value)))),
    UI.field('Rendición', UI.sel([['', 'Todas']].concat(S.rends.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).map((r) => [String(r.id), App.colorName(r.color) + ' · ' + C.fmtDate(r.fecha) + (r.nombre ? ' · ' + r.nombre : '')])), f.rend, (e) => setF('rend', e.target.value))),
    h('div', { class: 'grid2' }, UI.field('Cobro desde', dIn('desde')), UI.field('Cobro hasta', dIn('hasta'))),
    UI.btn('Quitar filtros', 'sm ghost', () => { st.f = { estado: 'Todas', rend: '', origen: '', desde: '', hasta: '', atajo: '' }; App.render(); }));
  // recupero proyectado
  if (!st.rec) st.rec = C.addDays(hoy, 10);
  const recBox = h('div'), recIn = dateInput(st.rec);
  const drawRec = () => {
    const d = C.parseEntrega(recIn.value, hoy);
    if (!d) { recBox.replaceChildren(errBox(['Fecha inválida.'])); return; }
    st.rec = d;
    const r = C.recupero(S, d);
    recBox.replaceChildren(h('div', null,
      h('div', { class: 'stats' }, App.stat('Colocaciones', String(r.cant)), App.stat('Capital', $(r.cap)), App.stat('Total a devolver', $(r.total)), App.stat('Ganancia', $(r.gan))),
      r.dias.length ? h('div', { class: 'tscroll' }, h('table', null, h('thead', null, h('tr', null, ['Día', 'Cant.', 'Total del día', 'Acumulado'].map((t) => h('th', null, t)))),
        h('tbody', null, r.dias.map((x) => h('tr', null, h('td', null, C.fmtDM(x.fecha) + (x.fecha < hoy ? ' (vencida)' : '')), h('td', { class: 'num' }, String(x.cant)), h('td', { class: 'num' }, $(x.total)), h('td', { class: 'num' }, $(x.acum))))))) : h('p', { class: 'mut' }, 'No hay cobros hasta esa fecha.')));
  };
  recIn.addEventListener('change', drawRec); drawRec();
  const cards = list.map((c) => {
    const e = App.estadoCol(c), on = sel && sel.indexOf(c.id) >= 0;
    const toggle = () => { const i = sel.indexOf(c.id); if (i >= 0) sel.splice(i, 1); else sel.push(c.id); App.render(); };
    return h('div', { class: 'card stripe c' + App.colorOf(c) + (on ? ' sel' : '') + (c.estado === 'En curso' && c.cob < hoy ? ' venc' : ''), onclick: sel ? toggle : null },
      h('div', { class: 'row sp' },
        h('div', { class: 'row' }, sel ? h('input', { type: 'checkbox', checked: on, 'aria-label': 'Marcar ' + App.titulo(c), onchange: toggle, onclick: (ev) => ev.stopPropagation() }) : null, h('strong', null, App.titulo(c))),
        h('span', { class: 'tag ' + e.cls }, c.estado === 'Cobrada' ? 'Cobrada' : c.cob < hoy ? 'Vencida' : 'En curso')),
      h('div', { class: 'num' }, $(c.cap) + ' → ' + $(c.total)),
      h('div', { class: 'mut small' }, C.fmtDM(c.ent) + ' → ' + C.fmtDate(c.cob) + ' · ' + e.txt),
      h('div', null, h('span', { class: 'tag' }, c.origen), h('span', { class: 'tag' }, c.marca), h('span', { class: 'mut small' }, App.colorName(App.colorOf(c)))),
      sel ? null : h('div', { class: 'row', style: null }, UI.btn('Editar', 'sm', () => openEdit(c)), UI.btn('Eliminar', 'sm ghost', () => borrarCol(c)), c.estado === 'En curso' ? UI.btn('Cobrar', 'sm', () => App.openCobro([c.id])) : null));
  });
  let bar = null;
  if (sel) {
    const chosen = S.cols.filter((c) => sel.indexOf(c.id) >= 0), ag = C.agregado(S, chosen), cobrables = chosen.filter((c) => c.estado === 'En curso');
    bar = h('div', null,
      h('div', { class: 'small num' }, h('strong', null, ag.cant + (ag.cant === 1 ? ' marcada' : ' marcadas')), ' · capital ' + $(ag.cap) + ' · a devolver ' + $(ag.total)),
      h('div', { class: 'small num' }, 'Ganancia bruta ' + $(ag.bruta) + ' · neta ' + $(ag.neta)),
      h('div', { class: 'grid2', style: null }, UI.btn('Salir de selección', 'ghost', () => { st.sel = null; App.render(); }),
        UI.btn('Cobrar seleccionadas', 'pri', () => { if (!cobrables.length) { UI.toast('Marcá al menos una colocación en curso.'); return; } App.openCobro(cobrables.map((c) => c.id)); })));
  }
  return {
    title: 'Colocaciones',
    body: h('div', null,
      h('div', { class: 'grid2' },
        UI.btn(st.orden === 'n' ? 'Orden: por N° (toma)' : 'Orden: por fecha de cobro', 'ghost', () => { st.orden = st.orden === 'n' ? 'cob' : 'n'; App.render(); }),
        UI.btn(sel ? 'Selección activa' : 'Seleccionar varias', sel ? 'pri' : '', () => { st.sel = sel ? null : []; App.render(); })),
      h('details', null, h('summary', { class: 'btn ghost full', style: null }, 'Filtros'), filtros),
      h('details', null, h('summary', { class: 'btn ghost full', style: null }, 'Recupero proyectado'), h('div', { class: 'card' }, UI.field('Hasta la fecha', recIn), recBox)),
      h('p', { class: 'mut small' }, list.length + ' de ' + all.length + ' colocaciones'),
      cards.length ? cards : h('p', { class: 'mut' }, S.cols.length ? 'Ninguna colocación coincide con los filtros.' : 'Todavía no hay colocaciones. Cargá una en Rendición.'),
      S.cols.length && !sel ? h('div', { style: null }, UI.btn('Renumerar desde 1', 'ghost sm', async () => {
        if (await UI.confirm('Se reasignan los N° desde 1 siguiendo el orden actual de N°, sin saltos. ¿Continuar?', { ok: 'Renumerar' })) { C.renumerar(S); await App.commit(); UI.toast('N° renumerados.'); }
      })) : null),
    bar
  };
};

/* =============== VENCIMIENTOS =============== */
SC.vencimientos = function () {
  const S = App.S, hoy = App.hoy();
  if (!App.ui.venc) App.ui.venc = { rango: 'todos', hasta: '', calRango: '30', montos: false, hora: null };
  const v = App.ui.venc;
  if (!v.hora) v.hora = S.cfg.calHora;
  let hasta = null;
  if (v.rango === 'fecha' && v.hasta) hasta = v.hasta; else if (['7', '15', '30'].indexOf(v.rango) >= 0) hasta = C.addDays(hoy, +v.rango);
  const grupos = C.grupos(S, hoy, hasta);
  const hastaIn = dateInput(v.hasta);
  hastaIn.addEventListener('change', () => { const d = C.parseEntrega(hastaIn.value, hoy); if (!d) { UI.toast('Fecha inválida.'); return; } v.rango = 'fecha'; v.hasta = d; App.render(); });
  const openGrupo = (g) => UI.modal((close) => {
    const on = {}; g.cols.forEach((c) => { on[c.id] = true; });
    const sumBox = h('div', { class: 'small num' });
    const upd = () => { const cs = g.cols.filter((c) => on[c.id]), a = C.agregado(S, cs); sumBox.textContent = a.cant + ' de ' + g.cols.length + ' · capital ' + $(a.cap) + ' · total ' + $(a.total) + ' · neta ' + $(a.neta); };
    upd();
    return h('div', null, h('h2', null, 'Cobrar el grupo del ' + C.fmtDate(g.fecha)), h('p', { class: 'mut small' }, 'Destildá las que no quieras cobrar ahora.'),
      g.cols.map((c) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { on[c.id] = e.target.checked; upd(); } }), App.titulo(c) + ' · ' + $(c.total))),
      sumBox, h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', close), UI.btn('Continuar', 'pri', () => { const ids = g.cols.filter((c) => on[c.id]).map((c) => c.id); if (!ids.length) { UI.toast('Dejá al menos una marcada.'); return; } close(); App.openCobro(ids); })));
  });
  const cards = grupos.map((g) => h('div', { class: 'card' + (g.estado === 'vencida' ? ' venc' : '') },
    h('div', { class: 'row sp' }, h('strong', null, C.fmtDate(g.fecha) + ' · ' + C.dow(g.fecha)), h('span', { class: 'tag ' + (g.estado === 'vencida' ? 'bad' : g.estado === 'hoy' ? 'warn' : '') }, C.diasTxt(g.dias))),
    g.cols.map((c) => h('div', { class: 'row sp small', style: null }, h('span', null, App.colorChip(App.colorOf(c)), App.titulo(c) + ' · ' + c.origen), h('span', { class: 'num' }, $(c.cap) + ' → ' + $(c.total)))),
    h('div', { class: 'live num' }, g.cant + (g.cant === 1 ? ' colocación' : ' colocaciones') + ' · capital ' + $(g.cap) + ' · total a cobrar ' + $(g.total) + ' · bruta ' + $(g.bruta) + ' · neta ' + $(g.neta)),
    h('div', { class: 'mut small num' }, 'Acumulado a esta fecha: ' + g.acum.cant + ' colocaciones · total ' + $(g.acum.total) + ' · neta ' + $(g.acum.neta)),
    h('div', { class: 'grid2', style: null }, UI.btn('Cobrar este grupo', 'pri', () => openGrupo(g)), UI.btn('Copiar resumen', '', async () => { UI.toast((await UI.copy(C.resumenTexto(g))) ? 'Resumen copiado.' : 'No se pudo copiar.'); }))));
  // calendario
  const horaIn = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: v.hora, oninput: (e) => { v.hora = e.target.value; } });
  const calMsg = h('div');
  const exportar = async () => {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(v.hora)) { calMsg.replaceChildren(errBox(['La hora debe ser hh:mm.'])); return; }
    const hastaCal = v.calRango === 'todos' ? null : C.addDays(hoy, +v.calRango);
    const gs = C.grupos(S, hoy, hastaCal).filter((g) => g.fecha >= hoy);
    if (!gs.length) { calMsg.replaceChildren(h('div', { class: 'alert warn' }, 'No hay vencimientos futuros en ese rango.')); return; }
    if (!(await UI.confirm('El archivo del calendario no está cifrado: se puede leer con cualquier programa. Borralo después de usarlo.', { ok: 'Exportar' }))) return;
    const cal = S.meta.cal || { fecha: null, hasta: null, mapa: {}, seq: {} };
    const seq = Object.assign({}, cal.seq);
    gs.forEach((g) => { seq[g.fecha] = (seq[g.fecha] || 0) + 1; });
    const hora = v.hora.length === 4 ? '0' + v.hora : v.hora;
    const txt = C.icsBuild({ grupos: gs, hora, montos: v.montos, seq: (f) => seq[f], ahora: new Date() });
    const r = await UI.share('vencimientos-' + UI.stamp() + '.ics', 'text/calendar', txt);
    if (r === 'cancelado') return;
    const mapa = {}; gs.forEach((g) => { mapa[g.fecha] = C.huellaVenc(g); });
    S.meta.cal = { fecha: hoy, hasta: hastaCal, mapa, seq };
    await App.commit(true);
    calMsg.replaceChildren(h('div', { class: 'alert ok' }, 'Calendario ' + r + ': ' + gs.length + (gs.length === 1 ? ' evento.' : ' eventos.') + ' Importalo en el calendario del teléfono.'));
    App.render();
  };
  const cal = h('details', null, h('summary', { class: 'btn ghost full', style: null }, 'Exportar vencimientos al calendario'),
    h('div', { class: 'card' },
      h('p', { class: 'mut small' }, 'La app no manda notificaciones propias. La alarma confiable es la del calendario del teléfono: importá el archivo .ics. Si cambia una fecha, volvé a exportar e importar. Las fechas ya vencidas no se exportan.'),
      UI.field('Rango', UI.sel([['15', 'Próximos 15 días'], ['30', 'Próximos 30 días'], ['60', 'Próximos 60 días'], ['todos', 'Todos los en curso']], v.calRango, (e) => { v.calRango = e.target.value; })),
      UI.field('Hora de inicio (hh:mm) · duración 30 min', horaIn),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: v.montos, onchange: (e) => { v.montos = e.target.checked; } }), 'Incluir montos (total del día) en el evento'),
      S.meta.cal && S.meta.cal.fecha ? h('p', { class: 'mut small' }, 'Última exportación: ' + C.fmtDate(S.meta.cal.fecha)) : null,
      calMsg, UI.btn('Exportar .ics', 'pri full', exportar)));
  return {
    title: 'Vencimientos',
    body: h('div', null,
      chips([['todos', 'Todos'], ['7', 'Próximos 7 días'], ['15', 'Próximos 15 días'], ['30', 'Próximos 30 días']], v.rango, (x) => { v.rango = x; App.render(); }),
      UI.field('Hasta una fecha elegida', hastaIn),
      cal,
      grupos.length ? cards : h('p', { class: 'mut' }, 'No hay vencimientos en este rango.'))
  };
};
})(window);

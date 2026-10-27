/* Núcleo de cálculo: sin acceso a pantalla, red ni almacenamiento. */
(function (root) {
'use strict';
const C = {};
const r2 = (x) => { const v = Math.round(x * 100) / 100; return v === 0 ? 0 : v; };
C.r2 = r2;

C.TIPOS_IN = ['Aporte', 'Financiamiento recibido', 'Cobro'];
C.TIPOS_OUT = ['Colocado', 'Pago de financiamiento', 'Retiro'];
C.TIPOS = C.TIPOS_IN.concat(C.TIPOS_OUT);
C.COLORES = [
  { n: 'Rojo', c: '#c62828' }, { n: 'Naranja', c: '#ef6c00' }, { n: 'Amarillo', c: '#f9c800' },
  { n: 'Verde', c: '#2e7d32' }, { n: 'Celeste', c: '#039be5' }, { n: 'Azul', c: '#283593' },
  { n: 'Violeta', c: '#8e24aa' }, { n: 'Marrón', c: '#6d4c41' }
];
C.DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/* ---------- números ---------- */
C.parseNum = function (s) {
  if (typeof s === 'number') return isFinite(s) ? s : NaN;
  if (s == null) return NaN;
  s = String(s).trim().replace(/\s/g, '').replace(/^(-?)\$/, '$1');
  if (!s) return NaN;
  let neg = false;
  if (s[0] === '-') { neg = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return NaN;
  let v;
  if (s.indexOf(',') >= 0) {
    const p = s.split(',');
    if (p.length > 2) return NaN;
    const ent = p[0].replace(/\./g, '');
    if (!/^\d*$/.test(ent) || !/^\d*$/.test(p[1])) return NaN;
    if (ent === '' && p[1] === '') return NaN;
    v = parseFloat((ent || '0') + '.' + (p[1] || '0'));
  } else if (s.indexOf('.') >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) v = parseFloat(s.replace(/\./g, ''));
    else if (/^\d*\.\d+$/.test(s)) v = parseFloat(s);
    else return NaN;
  } else v = parseInt(s, 10);
  return neg ? -v : v;
};
C.parseInt = function (s) {
  const v = C.parseNum(s);
  return isFinite(v) && Math.floor(v) === v ? v : NaN;
};
C.fmt = function (n, dec) {
  if (n == null || !isFinite(n)) return '—';
  dec = dec || 0;
  let neg = n < 0;
  let s = Math.abs(n).toFixed(dec);
  let [i, f] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (/^[0.,]*$/.test(i + (f || ''))) neg = false;
  return (neg ? '-' : '') + i + (f ? ',' + f : '');
};
C.money = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const v = Math.round(n);
  return (v < 0 ? '-$' : '$') + C.fmt(Math.abs(v));
};
C.pct = (n, dec) => (n == null || !isFinite(n)) ? '—' : C.fmt(n, dec == null ? 2 : dec) + '%';
C.roundTo = (x, m) => (m > 0 ? Math.floor(x / m + 0.5 + 1e-9) * m : r2(x));

/* ---------- fechas (siempre locales, sin UTC) ---------- */
C.dayNum = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
C.ymd = (n) => { const dt = new Date(n * 864e5); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; };
const p2 = (n) => (n < 10 ? '0' : '') + n;
C.dayToIso = (n) => { const o = C.ymd(n); return o.y + '-' + p2(o.m) + '-' + p2(o.d); };
C.isoToDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? C.dayNum(+m[1], +m[2], +m[3]) : NaN;
};
C.addDays = (iso, k) => C.dayToIso(C.isoToDay(iso) + k);
C.diffDays = (a, b) => C.isoToDay(a) - C.isoToDay(b);
C.fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; };
C.fmtDM = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] : '—'; };
C.dow = (iso) => C.DIAS[((C.isoToDay(iso) % 7) + 11) % 7];
C.today = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
C.monthKey = (iso) => (iso || '').slice(0, 7);
C.endOfMonth = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return C.dayToIso(C.dayNum(y, m + 1, 1) - 1); };
function mk(y, m, d) {
  if (!(y >= 1900 && y <= 2200)) return null;
  const n = C.dayNum(y, m, d), o = C.ymd(n);
  return (o.y === y && o.m === m && o.d === d) ? C.dayToIso(n) : null;
}
function splitDate(str) {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/.exec(String(str == null ? '' : str).trim());
  if (!m) return null;
  let y = m[3] ? +m[3] : null;
  if (y != null && m[3].length === 2) y += 2000;
  return { d: +m[1], m: +m[2], y };
}
/* Entrega: sin año usa el año actual. */
C.parseEntrega = function (str, hoy) {
  const s = splitDate(str); if (!s) return null;
  return mk(s.y == null ? +(hoy || C.today()).slice(0, 4) : s.y, s.m, s.d);
};
/* Cobro: sin año usa el de la entrega; si queda antes de la entrega, el año siguiente. */
C.parseCobro = function (str, entIso) {
  const s = splitDate(str); if (!s) return null;
  if (s.y != null) return mk(s.y, s.m, s.d);
  const base = entIso ? +entIso.slice(0, 4) : +C.today().slice(0, 4);
  let iso = mk(base, s.m, s.d);
  if (iso && entIso && iso < entIso) iso = mk(base + 1, s.m, s.d);
  return iso;
};

/* ---------- configuración ---------- */
C.defaultConfig = () => ({
  ok: false, tasa_propia: null, tasa_tabla: null, costo: null, reinv: null, redondeo: null,
  plazos: [], filas: [], tarifaPropio: 'Propia', tarifaFin: 'Tabla',
  alertaSaldo: 0, lockBg: 2, lockIdle: 5, calHora: '08:00'
});
const KEYS = { tasa_propia: 'tasa_propia', tasa_tabla: 'tasa_tabla', costo_financiamiento: 'costo', reinversion: 'reinv', redondeo: 'redondeo' };
C.validarTabla = function (plazos, filas) {
  const err = [];
  const seenP = {};
  plazos.forEach((p) => {
    if (!(Number.isInteger(p) && p >= 1)) err.push('Plazo inválido en la cabecera de la tabla: ' + p);
    else if (seenP[p]) err.push('Plazo repetido en la tabla: ' + p);
    seenP[p] = 1;
  });
  const seenC = {};
  filas.forEach((f, i) => {
    const n = 'Fila ' + (i + 1) + ' de la tabla';
    if (!(f.cap > 0)) err.push(n + ': capital inválido.');
    else if (seenC[f.cap]) err.push(n + ': capital repetido (' + C.fmt(f.cap) + ').');
    seenC[f.cap] = 1;
    if (f.vals.length !== plazos.length) err.push(n + ': tiene ' + f.vals.length + ' valores y la cabecera tiene ' + plazos.length + ' plazos.');
    let hay = 0;
    f.vals.forEach((v, j) => {
      if (v == null) return;
      hay++;
      if (!(v >= f.cap)) err.push(n + ', plazo ' + plazos[j] + ': el total no puede ser menor que el capital.');
    });
    if (!hay) err.push(n + ': no tiene ningún total cargado.');
  });
  return err;
};
C.sortTabla = function (cfg) {
  const idx = cfg.plazos.map((p, i) => i).sort((a, b) => cfg.plazos[a] - cfg.plazos[b]);
  const pl = idx.map((i) => cfg.plazos[i]);
  cfg.filas.forEach((f) => { f.vals = idx.map((i) => f.vals[i]); });
  cfg.plazos = pl;
  cfg.filas.sort((a, b) => a.cap - b.cap);
};
C.parseConfigText = function (text) {
  const errors = [], vals = {};
  let tabla = null;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim(); const L = 'Línea ' + (i + 1) + ': ';
    if (!t || t[0] === '#') return;
    if (/^tabla\s*;/i.test(t)) {
      if (tabla) { errors.push(L + 'hay más de una cabecera "tabla".'); return; }
      tabla = { plazos: [], filas: [] };
      t.split(';').slice(1).forEach((x) => {
        const p = C.parseInt(x);
        if (!(p >= 1)) errors.push(L + 'plazo inválido "' + x.trim() + '" en la cabecera.');
        tabla.plazos.push(p);
      });
      if (!tabla.plazos.length) errors.push(L + 'la cabecera de la tabla no tiene plazos.');
    } else if (t.indexOf(';') < 0 && t.indexOf('=') > 0) {
      const k = t.slice(0, t.indexOf('=')).trim().toLowerCase(), v = C.parseNum(t.slice(t.indexOf('=') + 1));
      if (!(k in KEYS)) { errors.push(L + 'dato desconocido "' + k + '".'); return; }
      if (!isFinite(v) || v < 0) { errors.push(L + 'valor inválido para ' + k + '.'); return; }
      if (k === 'reinversion' && v > 100) { errors.push(L + 'reinversion debe estar entre 0 y 100.'); return; }
      vals[KEYS[k]] = v;
    } else if (tabla && t.indexOf(';') > 0) {
      const parts = t.split(';').map((x) => x.trim());
      let d = false;
      if (/^d$/i.test(parts[parts.length - 1])) { d = true; parts.pop(); }
      if (parts.length !== tabla.plazos.length + 1) { errors.push(L + 'se esperaban ' + (tabla.plazos.length + 1) + ' columnas (capital y ' + tabla.plazos.length + ' totales) y hay ' + parts.length + '.'); return; }
      const cap = C.parseNum(parts[0]);
      if (!(cap > 0)) { errors.push(L + 'capital inválido "' + parts[0] + '".'); return; }
      const v = [];
      for (let j = 1; j < parts.length; j++) {
        if (parts[j] === '') { v.push(null); continue; }
        const x = C.parseNum(parts[j]);
        if (!isFinite(x)) { errors.push(L + 'total inválido "' + parts[j] + '".'); return; }
        v.push(x);
      }
      tabla.filas.push({ cap, vals: v, d });
    } else errors.push(L + 'no se entiende "' + t.slice(0, 40) + '".');
  });
  Object.keys(KEYS).forEach((k) => { if (!(KEYS[k] in vals)) errors.push('Falta el dato ' + k + '.'); });
  if (tabla && !errors.length) {
    errors.push.apply(errors, C.validarTabla(tabla.plazos, tabla.filas));
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, vals, tabla: tabla || { plazos: [], filas: [] } };
};
C.applyConfigParsed = function (cfg, r) {
  Object.assign(cfg, r.vals);
  cfg.plazos = r.tabla.plazos.slice();
  cfg.filas = r.tabla.filas.map((f) => ({ cap: f.cap, vals: f.vals.slice(), d: !!f.d }));
  C.sortTabla(cfg);
  cfg.ok = true;
};
C.configToText = function (cfg) {
  const L = ['tasa_propia=' + cfg.tasa_propia, 'tasa_tabla=' + cfg.tasa_tabla, 'costo_financiamiento=' + cfg.costo,
    'reinversion=' + cfg.reinv, 'redondeo=' + cfg.redondeo];
  if (cfg.plazos.length) {
    L.push('tabla;' + cfg.plazos.join(';'));
    cfg.filas.forEach((f) => L.push([f.cap].concat(f.vals.map((v) => (v == null ? '' : v))).concat(f.d ? ['D'] : []).join(';')));
  }
  return L.join('\n');
};
C.interesDia = (fila, plazos) => fila.vals.map((v, i) => (v == null ? null : (v - fila.cap) / plazos[i]));

/* ---------- fórmulas ---------- */
function tablaCalc(cfg, cap, d) {
  const fila = cfg.filas.find((f) => f.cap === cap);
  const regla = () => ({ total: C.roundTo(cap * (1 + cfg.tasa_tabla / 100 * d / 30), cfg.redondeo), marca: 'estimado' });
  if (!fila) return regla();
  const idx = cfg.plazos.indexOf(d);
  if (idx >= 0 && fila.vals[idx] != null) return { total: fila.vals[idx], marca: 'tabla' };
  const pts = cfg.plazos.map((p, i) => [p, fila.vals[i]]).filter((x) => x[1] != null).sort((a, b) => a[0] - b[0]);
  if (!pts.length) return regla();
  let total;
  if (fila.d || pts.length === 1) {
    const m = pts[pts.length - 1];
    total = cap + (m[1] - cap) / m[0] * d;
  } else {
    let i = 0;
    if (d >= pts[pts.length - 1][0]) i = pts.length - 2;
    else if (d > pts[0][0]) { while (!(d >= pts[i][0] && d <= pts[i + 1][0])) i++; }
    const a = pts[i], b = pts[i + 1];
    total = a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
  }
  return { total: C.roundTo(total, cfg.redondeo), marca: 'estimado' };
}
C.tablaCalc = tablaCalc;
C.calcTotal = function (cfg, cap, d, origen) {
  const tarifa = origen === 'Financiado' ? cfg.tarifaFin : cfg.tarifaPropio;
  if (tarifa === 'Tabla') return tablaCalc(cfg, cap, d);
  return { total: r2(cap * (1 + cfg.tasa_propia / 100 * d / 30)), marca: 'estimado' };
};
C.costoFin = (cfg, cap, d) => cap * cfg.costo / 100 * d / 30;
C.metr = function (col, cfg) {
  const gan = col.total - col.cap;
  const costo = col.estado === 'Cobrada' && col.costo != null ? col.costo : (col.origen === 'Financiado' ? C.costoFin(cfg, col.cap, col.plazo) : 0);
  return { gan, costo, neta: gan - costo, tasa: gan / col.cap * 30 / col.plazo * 100 };
};

/* ---------- estado ---------- */
C.newState = () => ({ v: 1, cfg: C.defaultConfig(), rends: [], cols: [], movs: [], meta: { next: 1, ultBackup: null, cal: null } });
C.newId = (S) => S.meta.next++;
C.renumerar = (S) => { S.cols.slice().sort((a, b) => a.n - b.n || a.id - b.id).forEach((c, i) => { c.n = i + 1; }); };
C.nextN = (S) => S.cols.reduce((m, c) => Math.max(m, c.n || 0), 0) + 1;
C.saldo = (S) => S.movs.reduce((a, m) => a + (C.TIPOS_IN.indexOf(m.tipo) >= 0 ? m.imp : -m.imp), 0);
C.addMov = function (S, m) {
  const mv = Object.assign({ id: C.newId(S), auto: false, colId: null, nota: '' }, m);
  S.movs.push(mv); return mv;
};
C.addAporte = (S, fecha, imp, nota) => C.addMov(S, { fecha, imp, tipo: 'Aporte', nota: nota || '' });
C.addRetiro = (S, fecha, imp, nota) => C.addMov(S, { fecha, imp, tipo: 'Retiro', nota: nota || '' });

C.validarFila = function (f) {
  if (!(f.cap > 0)) return 'El capital debe ser mayor que 0.';
  if (!(Number.isInteger(f.plazo) && f.plazo >= 1)) return 'El plazo debe ser un número entero de días, 1 o más.';
  if (!f.ent || !isFinite(C.isoToDay(f.ent))) return 'La fecha de entrega no es válida.';
  if (!f.cob || !isFinite(C.isoToDay(f.cob))) return 'La fecha de cobro no es válida.';
  if (C.diffDays(f.cob, f.ent) !== f.plazo) return 'El plazo no coincide con las fechas.';
  if (!(f.total >= f.cap)) return 'El total a devolver no puede ser menor que el capital.';
  if (f.origen !== 'Propio' && f.origen !== 'Financiado') return 'Falta el origen.';
  if (f.n != null && !(Number.isInteger(f.n) && f.n >= 1)) return 'El N° debe ser un entero positivo.';
  return null;
};
function movsColocacion(S, col) {
  if (col.origen === 'Financiado') C.addMov(S, { fecha: col.ent, imp: col.cap, tipo: 'Financiamiento recibido', auto: true, colId: col.id });
  C.addMov(S, { fecha: col.ent, imp: col.cap, tipo: 'Colocado', auto: true, colId: col.id });
}
C.addRend = function (S, head, filas) {
  const rend = { id: C.newId(S), fecha: head.fecha, color: head.color, nombre: head.nombre || '' };
  S.rends.push(rend);
  let next = C.nextN(S);
  const out = [];
  filas.forEach((f) => {
    const col = {
      id: C.newId(S), n: f.n != null ? f.n : next, alias: f.alias || '', cap: f.cap, ent: f.ent, cob: f.cob,
      plazo: f.plazo, origen: f.origen, total: f.total, marca: f.marca, estado: 'En curso', cobReal: null,
      rend: rend.id, costo: null, neta: null, reinv: null, retiro: null
    };
    next = Math.max(next, col.n) + 1;
    S.cols.push(col); movsColocacion(S, col); out.push(col);
  });
  return out;
};
C.resumenCobro = function (S, ids) {
  const cols = S.cols.filter((c) => ids.indexOf(c.id) >= 0 && c.estado === 'En curso');
  const r = { cols, cant: cols.length, capital: 0, total: 0, bruta: 0, costo: 0, neta: 0, pagoFin: 0 };
  cols.forEach((c) => {
    const m = C.metr(c, S.cfg);
    r.capital += c.cap; r.total += c.total; r.bruta += m.gan; r.costo += m.costo; r.neta += m.neta;
    if (c.origen === 'Financiado') r.pagoFin += c.cap + m.costo;
  });
  r.reinv = r2(r.neta * S.cfg.reinv / 100);
  r.retiro = r2(r.neta - r.reinv);
  return r;
};
C.cobrar = function (S, ids, fecha, reinvTotal) {
  const r = C.resumenCobro(S, ids);
  if (!r.cols.length) return r;
  const reinv = reinvTotal == null ? r.reinv : reinvTotal;
  let restoR = reinv, restoN = r.neta;
  r.cols.forEach((c, i) => {
    const m = C.metr(c, S.cfg);
    const last = i === r.cols.length - 1;
    const ri = last ? r2(restoR) : (restoN !== 0 ? r2(reinv * (m.neta / r.neta)) : 0);
    restoR -= ri; restoN -= m.neta;
    c.estado = 'Cobrada'; c.cobReal = fecha; c.costo = m.costo; c.neta = m.neta; c.reinv = ri; c.retiro = r2(m.neta - ri);
    C.addMov(S, { fecha, imp: c.total, tipo: 'Cobro', auto: true, colId: c.id });
    if (c.origen === 'Financiado') C.addMov(S, { fecha, imp: c.cap + m.costo, tipo: 'Pago de financiamiento', auto: true, colId: c.id });
    if (c.retiro > 0) C.addMov(S, { fecha, imp: c.retiro, tipo: 'Retiro', auto: true, colId: c.id });
  });
  r.reinv = reinv; r.retiro = r2(r.neta - reinv);
  return r;
};
C.deleteCol = function (S, id) {
  const col = S.cols.find((c) => c.id === id); if (!col) return;
  S.cols = S.cols.filter((c) => c.id !== id);
  S.movs = S.movs.filter((m) => m.colId !== id);
  if (!S.cols.some((c) => c.rend === col.rend)) S.rends = S.rends.filter((r) => r.id !== col.rend);
};
C.updateCol = function (S, id, patch) {
  const col = S.cols.find((c) => c.id === id); if (!col) return 'No existe.';
  const old = Object.assign({}, col);
  if (col.estado === 'Cobrada') { ['n', 'alias'].forEach((k) => { if (k in patch) col[k] = patch[k]; }); return null; }
  Object.assign(col, patch);
  if (patch.cob && !patch.plazo) col.plazo = C.diffDays(col.cob, col.ent);
  else if (patch.plazo && !patch.cob) col.cob = C.addDays(col.ent, col.plazo);
  else if (patch.ent && !patch.cob && !patch.plazo) col.cob = C.addDays(col.ent, col.plazo);
  const recalc = ['cap', 'plazo', 'origen'].some((k) => old[k] !== col[k]) || old.ent !== col.ent;
  if (patch.total != null && patch.total !== old.total) col.marca = 'manual';
  else if (recalc && (col.marca === 'tabla' || col.marca === 'estimado')) {
    const r = C.calcTotal(S.cfg, col.cap, col.plazo, col.origen); col.total = r.total; col.marca = r.marca;
  }
  const e = C.validarFila(col);
  if (e) { Object.assign(col, old); return e; }
  S.movs = S.movs.filter((m) => !(m.colId === id && (m.tipo === 'Colocado' || m.tipo === 'Financiamiento recibido')));
  movsColocacion(S, col);
  return null;
};

/* ---------- vencimientos ---------- */
C.enCurso = (S) => S.cols.filter((c) => c.estado === 'En curso');
C.grupos = function (S, hoy, hasta) {
  const map = {};
  C.enCurso(S).forEach((c) => { if (!hasta || c.cob <= hasta) (map[c.cob] = map[c.cob] || []).push(c); });
  const keys = Object.keys(map).sort();
  let aT = 0, aC = 0, aG = 0, aN = 0, aQ = 0;
  return keys.map((k) => {
    const cols = map[k].slice().sort((a, b) => a.n - b.n);
    const g = { fecha: k, cols, cant: cols.length, cap: 0, total: 0, bruta: 0, neta: 0 };
    cols.forEach((c) => { const m = C.metr(c, S.cfg); g.cap += c.cap; g.total += c.total; g.bruta += m.gan; g.neta += m.neta; });
    aQ += g.cant; aC += g.cap; aT += g.total; aG += g.bruta; aN += g.neta;
    g.acum = { cant: aQ, cap: aC, total: aT, bruta: aG, neta: aN };
    g.dias = C.diffDays(k, hoy);
    g.estado = g.dias < 0 ? 'vencida' : g.dias === 0 ? 'hoy' : 'futura';
    return g;
  });
};
C.diasTxt = (d) => d === 0 ? 'vence hoy' : d === 1 ? 'falta 1 día' : d > 0 ? 'faltan ' + d + ' días' : d === -1 ? 'vencida hace 1 día' : 'vencida hace ' + (-d) + ' días';
C.listaN = (cols) => cols.map((c) => c.n).sort((a, b) => a - b).join(', ');
C.resumenTexto = (g) => 'Cobros del ' + C.fmtDM(g.fecha) + ': filas ' + C.listaN(g.cols) + '. Total a cobrar ' + C.money(g.total) + '.';
C.proximaRendicion = function (S, hoy) {
  const g = C.grupos(S, hoy).find((x) => x.fecha >= hoy);
  return g || null;
};
C.recupero = function (S, hasta) {
  const cols = C.enCurso(S).filter((c) => c.cob <= hasta);
  const r = { cant: cols.length, cap: 0, total: 0, gan: 0, dias: [] };
  const map = {};
  cols.forEach((c) => { r.cap += c.cap; r.total += c.total; r.gan += c.total - c.cap; (map[c.cob] = map[c.cob] || []).push(c); });
  let ac = 0;
  Object.keys(map).sort().forEach((k) => {
    const t = map[k].reduce((a, c) => a + c.total, 0); ac += t;
    r.dias.push({ fecha: k, cant: map[k].length, total: t, acum: ac });
  });
  return r;
};
C.agregado = function (S, cols) {
  const r = { cant: cols.length, cap: 0, total: 0, bruta: 0, neta: 0 };
  cols.forEach((c) => { const m = C.metr(c, S.cfg); r.cap += c.cap; r.total += c.total; r.bruta += m.gan; r.neta += m.neta; });
  return r;
};

/* ---------- Radiografía ---------- */
C.radiografia = function (S, hoy) {
  const cfg = S.cfg, R = {};
  const cur = C.enCurso(S), cob = S.cols.filter((c) => c.estado === 'Cobrada');
  const sum = (a, f) => a.reduce((x, c) => x + f(c), 0);
  R.sinColocar = C.saldo(S);
  R.colocado = sum(cur, (c) => c.cap);
  R.colPropio = sum(cur.filter((c) => c.origen === 'Propio'), (c) => c.cap);
  R.colFin = sum(cur.filter((c) => c.origen === 'Financiado'), (c) => c.cap);
  R.capPropioJuego = R.sinColocar + R.colPropio;
  R.pctPropio = R.capPropioJuego === 0 ? null : R.colPropio / R.capPropioJuego * 100;
  R.finPend = sum(cur.filter((c) => c.origen === 'Financiado'), (c) => c.cap + C.costoFin(cfg, c.cap, c.plazo));
  const mv = (t) => sum(S.movs.filter((m) => m.tipo === t), (m) => m.imp);
  R.aportes = mv('Aporte'); R.retiros = mv('Retiro');
  R.netaCobrada = sum(cob, (c) => c.neta); R.reinvAcum = sum(cob, (c) => c.reinv);
  R.porCobrar = sum(cur, (c) => c.total);
  R.brutaXC = sum(cur, (c) => c.total - c.cap);
  R.costoXC = sum(cur, (c) => C.metr(c, cfg).costo);
  R.netaXC = R.brutaXC - R.costoXC;
  R.resultado = R.netaCobrada + R.netaXC;
  const cm = (a) => sum(a, (c) => c.cap * c.plazo / 30);
  const rate = (a, f) => cm(a) > 0 ? sum(a, f) / cm(a) * 100 : null;
  R.tasaNetaCob = rate(cob, (c) => c.neta);
  R.tasaBrutaCob = rate(cob, (c) => c.total - c.cap);
  R.tasaNetaCur = rate(cur, (c) => C.metr(c, cfg).neta);
  R.tasaBrutaCur = rate(cur, (c) => c.total - c.cap);
  const todas = S.cols;
  const capSum = sum(todas, (c) => c.cap);
  R.plazoProm = capSum > 0 ? sum(todas, (c) => c.cap * c.plazo) / capSum : null;
  const capDias = sum(todas, (c) => c.cap * c.plazo);
  const netaTodas = sum(todas, (c) => (c.estado === 'Cobrada' ? c.neta : C.metr(c, cfg).neta));
  R.netaPorCapDia = capDias > 0 ? netaTodas / capDias * 100 : null; // % diario sobre capital colocado
  R.propFin = capSum > 0 ? sum(todas.filter((c) => c.origen === 'Financiado'), (c) => c.cap) / capSum * 100 : null;
  const meses = {};
  const mes = (k) => (meses[k] = meses[k] || { mes: k, aportes: 0, colocado: 0, cobrado: 0, neta: 0, retirado: 0, reinv: 0 });
  S.movs.forEach((m) => {
    const o = mes(C.monthKey(m.fecha));
    if (m.tipo === 'Aporte') o.aportes += m.imp; else if (m.tipo === 'Colocado') o.colocado += m.imp;
    else if (m.tipo === 'Cobro') o.cobrado += m.imp; else if (m.tipo === 'Retiro') o.retirado += m.imp;
  });
  cob.forEach((c) => { const o = mes(C.monthKey(c.cobReal)); o.neta += c.neta; o.reinv += c.reinv; });
  R.meses = Object.keys(meses).sort().map((k) => meses[k]);
  R.semanas = [];
  for (let i = 0; i < 8; i++) {
    const a = C.addDays(hoy, i * 7), b = C.addDays(hoy, i * 7 + 6);
    const cs = cur.filter((c) => c.cob >= a && c.cob <= b);
    R.semanas.push({ desde: a, hasta: b, cant: cs.length, cap: sum(cs, (c) => c.cap), total: sum(cs, (c) => c.total), neta: sum(cs, (c) => C.metr(c, cfg).neta) });
  }
  const venc = cur.filter((c) => c.cob < hoy);
  R.vencidas = { cant: venc.length, cap: sum(venc, (c) => c.cap), total: sum(venc, (c) => c.total), neta: sum(venc, (c) => C.metr(c, cfg).neta) };
  R.cuadreIzq = R.sinColocar + R.colPropio;
  R.cuadreDer = R.aportes + R.netaCobrada - R.retiros;
  R.cuadreDif = R.cuadreIzq - R.cuadreDer;
  R.cuadreOk = Math.abs(R.cuadreDif) < 0.5;
  return R;
};

/* ---------- Calculadora ---------- */
C.tasaDe = (inp, cfg) => inp.tarifa === 'Propia' ? cfg.tasa_propia : inp.tarifa === 'Tabla' ? cfg.tasa_tabla : inp.tasaManual;
C.simular = function (inp, cfg) {
  const tasa = C.tasaDe(inp, cfg), d = inp.plazo, rec = inp.recolocar || 0, fin = inp.origen === 'Financiado';
  let n, sobr = 0;
  if (inp.modo === 'horizonte') { n = Math.floor(inp.horizonte / (d + rec)); sobr = inp.horizonte - n * (d + rec); } else n = inp.nCiclos;
  const rows = [];
  let capFin = inp.capital, extraT = 0, sumCD = 0;
  for (let i = 1; i <= n; i++) {
    const ini = i === 1 ? inp.capital : capFin;
    const extra = (inp.extra > 0 && i === inp.extraCiclo) ? inp.extra : 0;
    const eff = ini + extra;
    const bruta = eff * tasa / 100 * d / 30;
    const costo = fin ? eff * cfg.costo / 100 * d / 30 : 0;
    const neta = bruta - costo, reinv = neta * inp.reinv / 100, retiro = neta - reinv;
    capFin = fin ? reinv : eff + reinv;
    extraT += extra; sumCD += eff * d / 30;
    rows.push({ i, ini, extra, eff, bruta, costo, neta, retiro, reinv, fin: capFin });
  }
  const T = { n, sobrantes: sobr, dias: n * (d + rec) };
  T.neta = rows.reduce((a, r) => a + r.neta, 0);
  T.bruta = rows.reduce((a, r) => a + r.bruta, 0);
  T.costo = rows.reduce((a, r) => a + r.costo, 0);
  T.retiro = rows.reduce((a, r) => a + r.retiro, 0);
  T.extra = extraT; T.capFinal = n ? capFin : inp.capital;
  T.netaDia = T.dias > 0 ? T.neta / T.dias : 0;
  T.tasaEf = sumCD > 0 ? T.neta / sumCD * 100 : 0;
  return { rows, T, tasa };
};
C.sensibilidad = function (inp, cfg, plazos, porDia) {
  const base = C.tasaDe(inp, cfg), fin = inp.origen === 'Financiado';
  const tasas = [-10, -5, 0, 5, 10].map((k) => base + k);
  return {
    plazos, tasas, base,
    cel: tasas.map((t) => plazos.map((d) => {
      const neta = inp.capital * t / 100 * d / 30 - (fin ? inp.capital * cfg.costo / 100 * d / 30 : 0);
      return porDia ? neta / d : neta;
    }))
  };
};

/* ---------- Calendario (.ics) ---------- */
function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function utf8len(ch) { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
C.icsFold = function (line) {
  const out = []; let cur = '', bytes = 0, lim = 75;
  for (const ch of line) {
    const l = utf8len(ch);
    if (bytes + l > lim) { out.push(cur); cur = ' '; bytes = 1; lim = 75; }
    cur += ch; bytes += l;
  }
  out.push(cur);
  return out.join('\r\n');
};
C.icsTrigger = function (hora) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora || '08:00'); const min = (+m[1]) * 60 + (+m[2]) + 360;
  const h = Math.floor(min / 60), mm = min % 60;
  return '-PT' + h + 'H' + (mm ? mm + 'M' : '');
};
C.icsBuild = function (o) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(o.hora || '08:00');
  const hh = p2(+m[1]), mi = p2(+m[2]);
  const d = o.ahora || new Date();
  const stamp = d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SANFRA//Cobros//ES', 'CALSCALE:GREGORIAN'];
  o.grupos.forEach((g) => {
    const k = g.fecha.replace(/-/g, '');
    L.push('BEGIN:VEVENT', 'UID:cobros-' + k + '@sanfra.local', 'DTSTAMP:' + stamp, 'SEQUENCE:' + o.seq(g.fecha),
      'DTSTART:' + k + 'T' + hh + mi + '00', 'DURATION:PT30M',
      'SUMMARY:' + icsEsc('Cobros SANFRA: ' + g.cant),
      'DESCRIPTION:' + icsEsc('Filas: ' + C.listaN(g.cols) + (o.montos ? '\nTotal a cobrar: ' + C.money(g.total) : '')));
    [C.icsTrigger(o.hora), 'PT0S'].forEach((t) => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Cobros SANFRA', 'TRIGGER:' + t, 'END:VALARM'));
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(C.icsFold).join('\r\n') + '\r\n';
};
C.huellaVenc = (g) => C.listaN(g.cols);
C.calPendientes = function (S, hoy) {
  const cal = S.meta.cal; if (!cal) return 0;
  const gr = C.grupos(S, hoy).filter((g) => g.fecha >= hoy && (!cal.hasta || g.fecha <= cal.hasta));
  return gr.filter((g) => cal.mapa[g.fecha] !== C.huellaVenc(g)).length;
};

/* ---------- Respaldo ---------- */
C.csv = function (S) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const color = (id) => { const r = S.rends.find((x) => x.id === id); return r ? C.COLORES[r.color].n : ''; };
  const L = [['N', 'Alias', 'Capital', 'Entrega', 'Cobro', 'Plazo', 'Origen', 'Total', 'Marca', 'Estado', 'Cobro real', 'Rendicion'].map(q).join(';')];
  S.cols.slice().sort((a, b) => a.n - b.n).forEach((c) => L.push([c.n, c.alias, c.cap, c.ent, c.cob, c.plazo, c.origen, c.total, c.marca, c.estado, c.cobReal || '', color(c.rend)].map(q).join(';')));
  L.push('', ['Fecha', 'Importe', 'Tipo', 'Origen', 'Nota'].map(q).join(';'));
  S.movs.slice().sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id).forEach((m) => L.push([m.fecha, m.imp, m.tipo, m.auto ? 'automático' : 'manual', m.nota].map(q).join(';')));
  return L.join('\r\n') + '\r\n';
};
C.validarEstado = function (o) {
  if (!o || typeof o !== 'object') return 'El archivo no tiene el formato esperado.';
  if (o.v !== 1) return 'Versión de respaldo no reconocida.';
  if (!o.cfg || !Array.isArray(o.rends) || !Array.isArray(o.cols) || !Array.isArray(o.movs) || !o.meta) return 'Faltan secciones en el respaldo.';
  for (const c of o.cols) {
    if (!(c.cap > 0) || !(c.total >= 0) || !/^\d{4}-\d{2}-\d{2}$/.test(c.ent) || !/^\d{4}-\d{2}-\d{2}$/.test(c.cob)) return 'Hay una colocación con datos inválidos.';
  }
  for (const m of o.movs) {
    if (C.TIPOS.indexOf(m.tipo) < 0 || !isFinite(m.imp) || !/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) return 'Hay un movimiento con datos inválidos.';
  }
  return null;
};

root.Core = C;
})(typeof window !== 'undefined' ? window : globalThis);

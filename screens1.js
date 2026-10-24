/* Pantallas: configuración inicial, Inicio, Dinero, Agregar capital, Radiografía, Configuración, Respaldo. */
(function (root) {
'use strict';
const C = root.Core, V = root.Vault, UI = root.UI, App = root.App, h = UI.h, $ = C.money;
const SC = App.screens;

function errBox(list) { return list && list.length ? h('div', { class: 'alert bad', role: 'alert' }, list.map((e) => h('div', null, e))) : null; }
function colRow(col) {
  const e = App.estadoCol(col);
  return h('div', { class: 'rowcard c' + App.colorOf(col) },
    h('div', { class: 'row sp' }, h('strong', null, App.titulo(col)), h('span', { class: 'num' }, $(col.cap) + ' → ' + $(col.total))),
    h('div', { class: 'mut small' }, C.fmtDM(col.ent) + ' → ' + C.fmtDate(col.cob) + ' · ', h('span', { class: 'tag ' + e.cls }, e.txt)));
}
App.colRow = colRow;

/* ---------- configuración inicial ---------- */
SC.inicial = function () {
  const ta = h('textarea', { placeholder: 'Pegá acá el texto de configuración', spellcheck: 'false', autocomplete: 'off' });
  ta.value = App.ui.cfgText || '';
  const box = h('div');
  const go = UI.btn('Validar y aplicar', 'pri full', async () => {
    App.ui.cfgText = ta.value;
    const r = C.parseConfigText(ta.value);
    box.replaceChildren(r.ok ? '' : errBox(r.errors));
    if (!r.ok) return;
    C.applyConfigParsed(App.S.cfg, r);
    App.ui.cfgText = '';
    await App.commit(true);
    UI.toast('Configuración aplicada.');
    App.go('inicio');
  });
  return {
    title: 'Configuración inicial', nonav: true,
    body: h('div', null,
      h('p', null, 'Pegá el texto de configuración (una línea por dato: tasas, costo, reinversión, redondeo y la tabla). Se valida antes de aplicarlo.'),
      ta, box, h('div', { style: null }, go))
  };
};

/* ---------- Inicio ---------- */
App.alertas = function () {
  const S = App.S, hoy = App.hoy(), cur = C.enCurso(S), L = [];
  const venc = cur.filter((c) => c.cob < hoy);
  if (venc.length) L.push({ cls: 'bad', txt: venc.length + (venc.length === 1 ? ' colocación vencida sin cobrar' : ' colocaciones vencidas sin cobrar') + ' (filas ' + C.listaN(venc) + ').', go: 'vencimientos' });
  const prox = cur.filter((c) => c.cob >= hoy && c.cob <= C.addDays(hoy, 3));
  if (prox.length) L.push({ cls: 'warn', txt: 'Vencen en los próximos 3 días: ' + prox.length + ' (filas ' + C.listaN(prox) + '), ' + $(prox.reduce((a, c) => a + c.total, 0)) + ' a cobrar.', go: 'vencimientos' });
  const ub = S.meta.ultBackup;
  if (S.cols.length || S.movs.length) {
    if (!ub) L.push({ cls: 'warn', txt: 'Todavía no hiciste ningún respaldo.', go: 'respaldo' });
    else if (C.diffDays(hoy, ub) > 7) L.push({ cls: 'warn', txt: 'Respaldo pendiente: el último fue el ' + C.fmtDate(ub) + '.', go: 'respaldo' });
  }
  const np = C.calPendientes(S, hoy);
  if (np) L.push({ cls: 'info', txt: 'Tenés ' + np + (np === 1 ? ' vencimiento que no pasaste al calendario.' : ' vencimientos que no pasaste al calendario.'), go: 'vencimientos' });
  const sal = C.saldo(S);
  if (S.cfg.alertaSaldo > 0 && sal > S.cfg.alertaSaldo) L.push({ cls: 'info', txt: 'Tenés ' + $(sal) + ' sin colocar (más del límite que elegiste).', go: 'rendicion' });
  return L;
};
SC.inicio = function () {
  const S = App.S, hoy = App.hoy(), cur = C.enCurso(S), cfg = S.cfg;
  const sum = (a, f) => a.reduce((x, c) => x + f(c), 0);
  const cobradas = S.cols.filter((c) => c.estado === 'Cobrada');
  const fin = cur.filter((c) => c.origen === 'Financiado');
  const saldo = C.saldo(S);
  const nodes = [];
  nodes.push(h('div', { class: 'grid3' },
    UI.btn('Agregar capital', 'pri xl', () => App.go('aporte')),
    UI.btn('Nueva rendición', 'pri xl', () => App.go('rendicion')),
    UI.btn('Radiografía', 'pri xl', () => App.go('radiografia'))));
  nodes.push(h('div', { class: 'grid3', style: null }, UI.btn('Bloquear ahora', 'ghost sm', App.lockNow), UI.btn('Configuración', 'ghost sm', () => App.go('config')), UI.btn('Respaldo', 'ghost sm', () => App.go('respaldo'))));
  App.alertas().forEach((a) => nodes.push(h('div', { class: 'alert ' + a.cls }, h('div', { class: 'row' }, h('div', { class: 'grow' }, a.txt), a.go ? UI.btn('Ver', 'sm ghost', () => App.go(a.go)) : null))));
  nodes.push(h('div', { class: 'stats', style: null },
    App.stat('Capital en curso', $(sum(cur, (c) => c.cap))),
    App.stat('Total a devolverse', $(sum(cur, (c) => c.total))),
    App.stat('Ganancia a cobrar', $(sum(cur, (c) => c.total - c.cap))),
    App.stat('Saldo disponible (tocá para ver)', $(saldo), saldo < 0 ? 'warn' : '', () => App.go('dinero')),
    App.stat('Ganancia neta ya cobrada', $(sum(cobradas, (c) => c.neta))),
    App.stat('Colocaciones en curso', String(cur.length)),
    App.stat('Capital financiado en curso', $(sum(fin, (c) => c.cap))),
    App.stat('Costo de financiamiento pendiente', $(sum(fin, (c) => C.costoFin(cfg, c.cap, c.plazo))))));
  if (saldo < 0) nodes.push(h('div', { class: 'alert warn' }, 'El saldo disponible está en negativo. Revisá los movimientos de Dinero.'));
  const pr = C.proximaRendicion(S, hoy);
  nodes.push(h('h2', null, 'Próxima rendición'));
  nodes.push(pr ? h('button', { type: 'button', class: 'card full', style: null, onclick: () => App.go('vencimientos'), 'aria-label': 'Ver vencimientos' },
    h('div', null, h('strong', null, C.fmtDate(pr.fecha) + ' · ' + C.dow(pr.fecha)), ' · ', C.diasTxt(pr.dias)),
    h('div', null, pr.cant + (pr.cant === 1 ? ' colocación' : ' colocaciones') + ' · ' + $(pr.total) + ' a cobrar'))
    : h('p', { class: 'mut' }, 'No hay vencimientos próximos.'));
  nodes.push(h('h2', null, 'Próximos cobros'));
  const prox = cur.slice().sort((a, b) => (a.cob < b.cob ? -1 : a.cob > b.cob ? 1 : a.n - b.n)).slice(0, 8);
  nodes.push(prox.length ? prox.map(colRow) : h('p', { class: 'mut' }, 'Todavía no hay colocaciones en curso.'));
  nodes.push(h('h2', null, 'Rendiciones'));
  const rends = S.rends.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  nodes.push(rends.length ? rends.map((r) => {
    const cs = S.cols.filter((c) => c.rend === r.id);
    return h('div', { class: 'card stripe c' + r.color },
      h('div', { class: 'row sp' }, h('strong', null, C.fmtDate(r.fecha) + (r.nombre ? ' · ' + r.nombre : '')), h('span', { class: 'mut' }, App.colorName(r.color))),
      h('div', { class: 'mut' }, cs.length + ' colocaciones · capital ' + $(cs.reduce((a, c) => a + c.cap, 0)) + ' · ' + cs.filter((c) => c.estado === 'Cobrada').length + ' cobradas'));
  }) : h('p', { class: 'mut' }, 'Todavía no hay rendiciones.'));
  return { title: 'Inicio', body: h('div', null, nodes) };
};

/* ---------- Dinero para colocar ---------- */
function movForm(tipo, mov, done) {
  const imp = UI.num(mov ? mov.imp : ''), fecha = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: C.fmtDate(mov ? mov.fecha : App.hoy()) });
  const nota = h('input', { type: 'text', autocomplete: 'off', value: mov ? mov.nota : '' });
  const err = h('div');
  const save = async () => {
    const v = C.parseNum(imp.value), f = C.parseEntrega(fecha.value, App.hoy());
    const es = [];
    if (!(v > 0)) es.push('El importe debe ser mayor que 0.');
    if (!f) es.push('La fecha no es válida (dd/mm/aaaa).');
    if (es.length) { err.replaceChildren(errBox(es)); return null; }
    if (mov) { mov.imp = v; mov.fecha = f; mov.nota = nota.value.trim(); }
    else C.addMov(App.S, { fecha: f, imp: v, tipo, nota: nota.value.trim() });
    await App.commit(true);
    return v;
  };
  return { imp, fecha, nota, err, save };
}
SC.dinero = function () {
  const S = App.S, saldo = C.saldo(S), f = App.ui.movFiltro || 'Todos';
  const open = (tipo, mov) => UI.modal((close) => {
    const m = movForm(tipo, mov);
    return h('div', null, h('h2', null, (mov ? 'Editar ' : '') + (tipo === 'Aporte' ? 'aporte' : 'retiro')),
      UI.field('Importe', m.imp), UI.field('Fecha', m.fecha), UI.field('Nota (opcional)', m.nota), m.err,
      h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', close), UI.btn('Guardar', 'pri', async () => { if (await m.save()) { close(); App.render(); } })));
  });
  const movs = S.movs.filter((m) => f === 'Todos' || m.tipo === f).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  return {
    title: 'Dinero para colocar', back: 'inicio',
    body: h('div', null,
      h('div', { class: 'card' }, h('div', { class: 'mut' }, 'Saldo disponible'), h('div', { class: 'big num' }, $(saldo))),
      saldo < 0 ? h('div', { class: 'alert warn' }, 'El saldo quedó en negativo. No se bloquea nada: revisá los movimientos.') : null,
      h('div', { class: 'grid2' }, UI.btn('Aporte', 'pri', () => open('Aporte')), UI.btn('Retiro', '', () => open('Retiro'))),
      h('label', { class: 'f' }, 'Filtrar por tipo'),
      UI.sel(['Todos'].concat(C.TIPOS), f, (e) => { App.ui.movFiltro = e.target.value; App.render(); }),
      h('h2', null, 'Movimientos'),
      movs.length ? movs.map((m) => {
        const entra = C.TIPOS_IN.indexOf(m.tipo) >= 0;
        return h('div', { class: 'card' },
          h('div', { class: 'row sp' }, h('strong', null, m.tipo), h('strong', { class: 'num' }, (entra ? '+' : '−') + $(m.imp))),
          h('div', { class: 'mut small' }, C.fmtDate(m.fecha) + ' · ' + (m.auto ? 'automático' : 'manual') + (m.colId ? ' · ' + (() => { const c = S.cols.find((x) => x.id === m.colId); return c ? 'N° ' + c.n : ''; })() : '') + (m.nota ? ' · ' + m.nota : '')),
          !m.auto ? h('div', { class: 'row', style: null }, UI.btn('Editar', 'sm', () => open(m.tipo, m)), UI.btn('Borrar', 'sm bad', async () => {
            if (await UI.confirm('¿Borrar este movimiento de ' + $(m.imp) + '?', { ok: 'Borrar', danger: true })) { S.movs = S.movs.filter((x) => x !== m); await App.commit(); }
          })) : null);
      }) : h('p', { class: 'mut' }, 'Todavía no hay movimientos.'))
  };
};

SC.aporte = function () {
  const ok = App.ui.aporteOk;
  if (ok) {
    return {
      title: 'Agregar capital', back: 'inicio',
      body: h('div', null, h('div', { class: 'alert ok' }, h('strong', null, 'Ahora tenés ' + $(C.saldo(App.S)) + ' sin colocar.')),
        h('div', { class: 'grid2' }, UI.btn('Colocar ahora', 'pri', () => { App.ui.aporteOk = null; App.go('rendicion'); }), UI.btn('Agregar otro', '', () => { App.ui.aporteOk = null; App.render(); })))
    };
  }
  const m = movForm('Aporte', null);
  return {
    title: 'Agregar capital', back: 'inicio',
    body: h('div', null, h('p', { class: 'mut' }, 'Un aporte suma al saldo disponible y no es ganancia.'),
      UI.field('Monto', m.imp), UI.field('Fecha', m.fecha), UI.field('Nota (opcional)', m.nota), m.err,
      h('div', { style: null }, UI.btn('Guardar aporte', 'pri full', async () => { if (await m.save()) { App.ui.aporteOk = true; App.render(); } })))
  };
};

/* ---------- Radiografía ---------- */
SC.radiografia = function () {
  const S = App.S, R = C.radiografia(S, App.hoy());
  const row = (k, v, cls) => h('tr', null, h('td', null, k), h('td', { class: 'num ' + (cls || '') }, v));
  const tbl = (rows) => h('table', null, h('tbody', null, rows));
  const bars = (() => {
    const ms = R.meses; if (!ms.length) return h('p', { class: 'mut' }, 'Todavía no hay datos.');
    const mx = Math.max.apply(null, ms.map((m) => Math.abs(m.neta)).concat([1]));
    const W = 330, Hh = 100, bw = Math.max(14, Math.min(40, Math.floor(W / ms.length) - 6));
    const g = ms.map((m, i) => {
      const x = 4 + i * (bw + 6), hh = Math.round(Math.abs(m.neta) / mx * 70);
      return UI.svg('g', null,
        UI.svg('rect', { x, y: 82 - hh, width: bw, height: Math.max(hh, 1), fill: m.neta < 0 ? '#b3261e' : '#0b5cad', rx: 3 }),
        UI.svg('text', { x: x + bw / 2, y: 96, 'text-anchor': 'middle', 'font-size': 9, fill: '#5b6672' }, m.mes.slice(5) + '/' + m.mes.slice(2, 4)),
        UI.svg('text', { x: x + bw / 2, y: 78 - hh, 'text-anchor': 'middle', 'font-size': 8, fill: '#1b1f24' }, C.fmt(Math.round(m.neta / 1000)) + 'k'));
    });
    return h('div', { class: 'tscroll' }, UI.svg('svg', { viewBox: '0 0 ' + Math.max(W, ms.length * (bw + 6) + 8) + ' ' + Hh, width: Math.max(W, ms.length * (bw + 6) + 8), height: Hh, role: 'img', 'aria-label': 'Ganancia neta por mes' }, g));
  })();
  return {
    title: 'Radiografía', back: 'inicio',
    body: h('div', null,
      h('h2', null, 'A. Capital hoy'),
      tbl([row('Sin colocar', $(R.sinColocar)), row('Colocado en curso', $(R.colocado)), row('   · Propio', $(R.colPropio)), row('   · Financiado', $(R.colFin)),
        row('Capital propio en juego', $(R.capPropioJuego)), row('% de capital propio colocado', R.pctPropio == null ? '—' : C.pct(R.pctPropio)),
        row('Financiamiento pendiente de devolver', $(R.finPend))]),
      h('h2', null, 'B. Acumulados'),
      tbl([row('Aportes acumulados', $(R.aportes)), row('Ganancia neta cobrada', $(R.netaCobrada)), row('Retiros acumulados', $(R.retiros)), row('Reinvertido acumulado', $(R.reinvAcum)),
        row('Total a cobrar (en curso)', $(R.porCobrar)), row('Ganancia bruta por cobrar', $(R.brutaXC)), row('Costo de financiamiento por cobrar', $(R.costoXC)),
        row('Ganancia neta por cobrar', $(R.netaXC)), row('Resultado total', $(R.resultado))]),
      h('h2', null, 'C. Rendimiento'),
      tbl([row('Tasa mensual ponderada neta (cobradas)', C.pct(R.tasaNetaCob)), row('Tasa mensual ponderada bruta (cobradas)', C.pct(R.tasaBrutaCob)),
        row('Tasa mensual ponderada neta (en curso)', C.pct(R.tasaNetaCur)), row('Tasa mensual ponderada bruta (en curso)', C.pct(R.tasaBrutaCur)),
        row('Plazo promedio ponderado por capital', R.plazoProm == null ? '—' : C.fmt(R.plazoProm, 1) + ' días'),
        row('Ganancia neta por día de capital colocado', R.netaPorCapDia == null ? '—' : C.fmt(R.netaPorCapDia, 4) + '% diario'),
        row('Capital financiado sobre el colocado total', R.propFin == null ? '—' : C.pct(R.propFin))]),
      h('h2', null, 'D. Por mes'),
      bars,
      R.meses.length ? h('div', { class: 'tscroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Mes', 'Aportes', 'Colocado', 'Cobrado', 'Neta', 'Retirado', 'Reinv.'].map((t) => h('th', null, t)))),
        h('tbody', null, R.meses.map((m) => h('tr', null, h('td', null, m.mes.slice(5) + '/' + m.mes.slice(0, 4)), [m.aportes, m.colocado, m.cobrado, m.neta, m.retirado, m.reinv].map((v) => h('td', { class: 'num' }, C.fmt(Math.round(v))))))))) : null,
      h('h2', null, 'E. Cobros de las próximas 8 semanas'),
      R.vencidas.cant ? h('div', { class: 'alert bad' }, 'Vencidas sin cobrar: ' + R.vencidas.cant + ' · capital ' + $(R.vencidas.cap) + ' · total ' + $(R.vencidas.total) + ' · neta ' + $(R.vencidas.neta)) : null,
      h('div', { class: 'tscroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Semana', 'Cant.', 'Capital', 'Total', 'Neta'].map((t) => h('th', null, t)))),
        h('tbody', null, R.semanas.map((w) => h('tr', null, h('td', null, C.fmtDM(w.desde) + '–' + C.fmtDM(w.hasta)), [C.fmt(w.cant), C.fmt(Math.round(w.cap)), C.fmt(Math.round(w.total)), C.fmt(Math.round(w.neta))].map((v) => h('td', { class: 'num' }, v))))))),
      h('h2', null, 'F. Cuadre'),
      R.cuadreOk ? h('div', { class: 'alert ok' }, h('strong', null, 'Cuadre OK'))
        : h('div', { class: 'alert bad' }, h('strong', null, 'Diferencia de ' + $(R.cuadreDif)), h('div', { class: 'small' }, 'Sin colocar + colocado Propio en curso (' + $(R.cuadreIzq) + ') debería ser igual a aportes + ganancia neta cobrada − retiros (' + $(R.cuadreDer) + '). No se corrigió nada.'), UI.btn('Ver movimientos', 'sm', () => App.go('dinero'))))
  };
};

/* ---------- Configuración ---------- */
function newDraft(cfg) {
  const s = (v) => (v == null ? '' : String(v).replace('.', ','));
  return {
    tasa_propia: s(cfg.tasa_propia), tasa_tabla: s(cfg.tasa_tabla), costo: s(cfg.costo), reinv: s(cfg.reinv), redondeo: s(cfg.redondeo),
    tarifaPropio: cfg.tarifaPropio, tarifaFin: cfg.tarifaFin, alertaSaldo: s(cfg.alertaSaldo), lockBg: s(cfg.lockBg), lockIdle: s(cfg.lockIdle), calHora: cfg.calHora,
    plazos: cfg.plazos.map(s), filas: cfg.filas.map((f) => ({ cap: s(f.cap), vals: f.vals.map(s), d: f.d }))
  };
}
function draftToCfg(d, cfg) {
  const err = [], P = C.parseNum;
  const rate = (k, name, max) => { const v = P(d[k]); if (!(v >= 0) || (max && v > max)) err.push(name + ' no es válido.'); return v; };
  const o = {
    tasa_propia: rate('tasa_propia', 'La tasa propia'), tasa_tabla: rate('tasa_tabla', 'La tasa Tabla'), costo: rate('costo', 'El costo de financiamiento'),
    reinv: rate('reinv', 'El % de reinversión', 100), redondeo: rate('redondeo', 'El redondeo'), alertaSaldo: P(d.alertaSaldo || '0'),
    lockBg: C.parseInt(d.lockBg), lockIdle: C.parseInt(d.lockIdle)
  };
  if (!(o.alertaSaldo >= 0)) err.push('El límite de saldo sin colocar no es válido.');
  if (!(o.lockBg >= 1 && o.lockBg <= 30) || !(o.lockIdle >= 1 && o.lockIdle <= 30)) err.push('Los tiempos de bloqueo deben estar entre 1 y 30 minutos.');
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(d.calHora)) err.push('La hora de inicio del calendario debe ser hh:mm.');
  const plazos = d.plazos.map((x) => C.parseInt(x));
  const filas = d.filas.map((f) => ({ cap: P(f.cap), vals: f.vals.map((x) => (String(x).trim() === '' ? null : P(x))), d: f.d }));
  filas.forEach((f) => f.vals.forEach((v, j) => { if (v != null && !isFinite(v)) err.push('Hay un total inválido en la fila de capital ' + C.fmt(f.cap) + ', plazo ' + plazos[j] + '.'); }));
  err.push.apply(err, C.validarTabla(plazos, filas));
  if (err.length) return { err };
  const next = Object.assign({}, cfg, o, { tarifaPropio: d.tarifaPropio, tarifaFin: d.tarifaFin, calHora: d.calHora.length === 4 ? '0' + d.calHora : d.calHora, plazos, filas, ok: true });
  C.sortTabla(next);
  return { cfg: next };
}
SC.config = function () {
  const S = App.S;
  if (!App.ui.draft) App.ui.draft = newDraft(S.cfg);
  const d = App.ui.draft;
  const txt = (k, label, hint) => { const i = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: d[k], oninput: (e) => { d[k] = e.target.value; } }); return UI.field(label, i, hint); };
  const tarifaSel = (k, label) => UI.field(label, UI.sel(['Propia', 'Tabla'], d[k], (e) => { d[k] = e.target.value; }));
  const errs = h('div'), tablaBox = h('div');
  const perDay = (f) => {
    const cap = C.parseNum(f.cap); const out = [];
    f.vals.forEach((v, j) => { const x = C.parseNum(v), p = C.parseInt(d.plazos[j]); if (cap > 0 && isFinite(x) && p >= 1) out.push(p + ' d: ' + $((x - cap) / p) + '/día'); });
    return out.join(' · ') || 'Interés por día: —';
  };
  const drawTabla = () => {
    tablaBox.replaceChildren(h('div', null,
      h('label', { class: 'f' }, 'Plazos de la tabla (días)'),
      h('div', { class: 'row wrap' }, d.plazos.map((p, j) => h('div', { class: 'row', style: null },
        h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: p, 'aria-label': 'Plazo ' + (j + 1), oninput: (e) => { d.plazos[j] = e.target.value; refreshPD(); } }),
        h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': 'Quitar plazo', onclick: () => { d.plazos.splice(j, 1); d.filas.forEach((f) => f.vals.splice(j, 1)); drawTabla(); } }, '×'))),
        UI.btn('+ Plazo', 'sm', () => { d.plazos.push(''); d.filas.forEach((f) => f.vals.push('')); drawTabla(); })),
      d.filas.map((f, i) => {
        const pd = h('div', { class: 'mut small' }, perDay(f));
        pd.dataset.fila = i;
        return h('div', { class: 'card' },
          h('div', { class: 'row sp' }, h('strong', null, 'Capital'), UI.btn('Borrar fila', 'sm bad', async () => { if (await UI.confirm('¿Borrar esta fila de la tabla?', { ok: 'Borrar', danger: true })) { d.filas.splice(i, 1); drawTabla(); } })),
          h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: f.cap, oninput: (e) => { f.cap = e.target.value; pd.textContent = perDay(f); } }),
          h('div', { class: 'grid2' }, f.vals.map((v, j) => h('div', null, h('label', { class: 'f' }, 'Total a ' + (d.plazos[j] || '?') + ' días'),
            h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: v, oninput: (e) => { f.vals[j] = e.target.value; pd.textContent = perDay(f); } })))),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: f.d, onchange: (e) => { f.d = e.target.checked; } }), 'Fila con marca D (interés proporcional a los días)'),
          pd);
      }),
      UI.btn('+ Fila de capital', 'sm', () => { d.filas.push({ cap: '', vals: d.plazos.map(() => ''), d: false }); drawTabla(); })));
  };
  const refreshPD = () => { tablaBox.querySelectorAll('[data-fila]').forEach((el) => { el.textContent = perDay(d.filas[+el.dataset.fila]); }); };
  drawTabla();
  const imp = h('textarea', { placeholder: 'Texto de configuración para importar', spellcheck: 'false', autocomplete: 'off' });
  const impBox = h('div');
  const save = async () => {
    const r = draftToCfg(d, S.cfg);
    errs.replaceChildren(errBox(r.err) || '');
    if (r.err) { window.scrollTo(0, 0); return; }
    S.cfg = r.cfg; App.ui.draft = null;
    await App.commit(true); App.resetIdle();
    UI.toast('Configuración guardada.'); App.render();
  };
  const pwSection = () => {
    const a = UI.pw('Contraseña actual'), b = UI.pw('Contraseña nueva (mínimo 6)'), c2 = UI.pw('Repetir la nueva'), msg = h('div');
    return h('div', { class: 'card' }, h('h3', null, 'Cambiar contraseña'), a.wrap, b.wrap, c2.wrap, msg,
      h('div', { class: 'alert warn small' }, 'Si olvidás la contraseña, los datos no se pueden recuperar. Nadie puede recuperarlos.'),
      UI.btn('Cambiar contraseña', '', async () => {
        const fail = (t) => msg.replaceChildren(errBox([t]));
        if (b.input.value.length < 6) return fail('La nueva contraseña debe tener al menos 6 caracteres.');
        if (b.input.value !== c2.input.value) return fail('Las contraseñas nuevas no coinciden.');
        try { await V.verify(a.input.value); } catch (e) { return fail('Contraseña incorrecta'); }
        await V.changePassword(a.input.value, b.input.value, S);
        a.input.value = b.input.value = c2.input.value = '';
        msg.replaceChildren(h('div', { class: 'alert ok' }, 'Contraseña cambiada. Los datos se volvieron a cifrar.'));
      }));
  };
  const destroy = () => {
    const w = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'DESTRUIR' }), p = UI.pw('Tu contraseña'), msg = h('div');
    return h('div', { class: 'danger' }, h('h3', null, 'Zona de peligro'),
      h('p', null, 'Borra TODO: datos, configuración, copias en caché y registros de la app en este teléfono. No se puede deshacer.'),
      UI.field('Escribí la palabra DESTRUIR', w), UI.field('Contraseña', p.wrap), msg,
      UI.btn('Destruir todos los datos', 'bad full', async () => {
        if (w.value.trim() !== 'DESTRUIR') return msg.replaceChildren(errBox(['Tenés que escribir exactamente DESTRUIR.']));
        try { await V.verify(p.input.value); } catch (e) { return msg.replaceChildren(errBox(['Contraseña incorrecta'])); }
        await App.destroyAndReset();
      }));
  };
  return {
    title: 'Configuración', back: 'inicio',
    body: h('div', null, errs,
      h('h2', null, 'Tasas y reglas'),
      txt('tasa_propia', 'Tasa mensual del capital propio (%)'), txt('tasa_tabla', 'Tasa mensual de la tarifa Tabla (%)'),
      txt('costo', 'Costo mensual del capital financiado (%)'), txt('reinv', '% de la ganancia neta que se reinvierte'), txt('redondeo', 'Múltiplo de redondeo para totales estimados'),
      tarifaSel('tarifaPropio', 'Tarifa del origen Propio'), tarifaSel('tarifaFin', 'Tarifa del origen Financiado'),
      h('h2', null, 'Tabla de tarifas'), tablaBox,
      h('h2', null, 'Alertas, bloqueo y calendario'),
      txt('alertaSaldo', 'Alertar si hay más de $X sin colocar (0 = desactivada)'),
      txt('lockBg', 'Bloquear tras minutos en segundo plano (1 a 30)'), txt('lockIdle', 'Bloquear tras minutos de inactividad (1 a 30)'),
      txt('calHora', 'Hora de inicio de los eventos de calendario (hh:mm)'),
      h('div', { style: null }, UI.btn('Guardar configuración', 'pri full', save)),
      h('h2', null, 'Importar / exportar texto'),
      imp, impBox,
      h('div', { class: 'grid2', style: null },
        UI.btn('Validar y aplicar', '', async () => {
          const r = C.parseConfigText(imp.value);
          impBox.replaceChildren(r.ok ? h('div', { class: 'alert ok' }, 'Configuración aplicada.') : errBox(r.errors));
          if (!r.ok) return;
          C.applyConfigParsed(S.cfg, r); App.ui.draft = null; await App.commit(true); App.render();
        }),
        UI.btn('Exportar configuración', '', () => { imp.value = C.configToText(S.cfg); impBox.replaceChildren(h('div', { class: 'alert warn small' }, 'Este texto se puede leer con cualquier programa. No lo compartas ni lo guardes sin cuidado.')); })),
      h('h2', null, 'Seguridad'), pwSection(), destroy())
  };
};

/* ---------- Respaldo ---------- */
SC.respaldo = function () {
  const S = App.S;
  const k1 = UI.pw('Clave del respaldo'), k2 = UI.pw('Repetir la clave'), msg = h('div');
  const fileIn = h('input', { type: 'file', accept: '.sanfra,.json,application/json,text/plain' });
  const pasteTa = h('textarea', { placeholder: 'O pegá acá el contenido del respaldo', spellcheck: 'false', autocomplete: 'off' });
  const say = (kind, t) => msg.replaceChildren(h('div', { class: 'alert ' + kind }, t));
  const mark = async () => { S.meta.ultBackup = App.hoy(); await App.commit(true); };
  const importar = async (text) => {
    let obj;
    try {
      if (V.isEnc(text)) {
        const pw = await new Promise((res) => UI.modal((close) => { const p = UI.pw('Clave del respaldo'); return h('div', null, h('h2', null, 'Clave del respaldo'), p.wrap, h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', () => { close(); res(null); }), UI.btn('Abrir', 'pri', () => { const v = p.input.value; close(); res(v); }))); }));
        if (pw == null) return;
        try { obj = await V.importEnc(text, pw); } catch (e) { say('bad', 'Clave incorrecta o archivo dañado. No se tocó ningún dato.'); return; }
      } else obj = JSON.parse(text);
    } catch (e) { say('bad', 'El archivo no tiene el formato esperado. No se tocó ningún dato.'); return; }
    const bad = C.validarEstado(obj);
    if (bad) { say('bad', bad + ' No se tocó ningún dato.'); return; }
    if (!(await UI.confirm('Esto reemplaza TODOS los datos actuales por los del respaldo (' + obj.cols.length + ' colocaciones, ' + obj.movs.length + ' movimientos). ¿Continuar?', { ok: 'Reemplazar', danger: true }))) return;
    obj.cfg = Object.assign(C.defaultConfig(), obj.cfg);
    App.S = obj; App.ui = {};
    await V.save(App.S);
    say('ok', 'Respaldo importado.'); App.render();
  };
  return {
    title: 'Respaldo', back: 'inicio',
    body: h('div', null, msg,
      S.meta.ultBackup ? h('p', { class: 'mut' }, 'Último respaldo: ' + C.fmtDate(S.meta.ultBackup)) : h('p', { class: 'mut' }, 'Todavía no hiciste ningún respaldo.'),
      h('div', { class: 'card' }, h('h3', null, 'Exportar cifrado con clave (recomendado)'),
        h('p', { class: 'mut small' }, 'Podés usar la misma contraseña de la app o una distinta. Si perdés la clave, el respaldo no se puede recuperar.'),
        k1.wrap, k2.wrap,
        UI.btn('Exportar cifrado', 'pri full', async () => {
          if (k1.input.value.length < 6) return say('bad', 'La clave debe tener al menos 6 caracteres.');
          if (k1.input.value !== k2.input.value) return say('bad', 'Las claves no coinciden.');
          const txt = await V.exportEnc(S, k1.input.value);
          k1.input.value = k2.input.value = '';
          const r = await UI.share('respaldo-' + UI.stamp() + '.sanfra', 'application/octet-stream', txt);
          if (r !== 'cancelado') { await mark(); say('ok', 'Respaldo cifrado ' + r + '.'); }
        })),
      h('div', { class: 'card' }, h('h3', null, 'Importar respaldo'),
        UI.field('Archivo', fileIn), pasteTa,
        UI.btn('Importar', 'full', async () => {
          let t = pasteTa.value.trim();
          if (!t && fileIn.files[0]) t = (await UI.readFile(fileIn.files[0])).trim();
          if (!t) return say('bad', 'Elegí un archivo o pegá el contenido.');
          await importar(t);
        })),
      h('div', { class: 'card' }, h('h3', null, 'Exportar sin cifrar'),
        h('div', { class: 'alert warn small' }, 'Este archivo se puede leer con cualquier programa. Borralo después de usarlo.'),
        h('div', { class: 'grid2' },
          UI.btn('JSON', '', async () => {
            if (!(await UI.confirm('Este archivo se puede leer con cualquier programa. Borralo después de usarlo.', { ok: 'Exportar' }))) return;
            const r = await UI.share('respaldo-' + UI.stamp() + '.json', 'application/json', JSON.stringify(S));
            if (r !== 'cancelado') { await mark(); say('ok', 'JSON ' + r + '.'); }
          }),
          UI.btn('CSV', '', async () => {
            if (!(await UI.confirm('Este archivo se puede leer con cualquier programa. Borralo después de usarlo.', { ok: 'Exportar' }))) return;
            const r = await UI.share('datos-' + UI.stamp() + '.csv', 'text/csv', C.csv(S));
            if (r !== 'cancelado') say('ok', 'CSV ' + r + '.');
          }))))
  };
};
})(window);

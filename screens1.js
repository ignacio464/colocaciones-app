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
  const cj = C.cajas(S);
  if (cj.cobr > 0.5) L.push({ cls: 'info', txt: 'Tenés ' + $(cj.cobr) + ' cobrado por asignar: pasalo a colocar o apartalo.', go: 'dinero' });
  const ub = S.meta.ultBackup;
  if (S.cols.length || S.movs.length) {
    if (!ub) L.push({ cls: 'warn', txt: 'Todavía no hiciste ningún respaldo.', go: 'respaldo' });
    else if (C.diffDays(hoy, ub) > 7) L.push({ cls: 'warn', txt: 'Respaldo pendiente: el último fue el ' + C.fmtDate(ub) + '.', go: 'respaldo' });
  }
  const np = C.calPendientes(S, hoy);
  if (np) L.push({ cls: 'info', txt: 'Tenés ' + np + (np === 1 ? ' vencimiento que no pasaste al calendario.' : ' vencimientos que no pasaste al calendario.'), go: 'vencimientos' });
  if (S.cfg.alertaSaldo > 0 && cj.disp > S.cfg.alertaSaldo) L.push({ cls: 'info', txt: 'Tenés ' + $(cj.disp) + ' sin colocar (más del límite que elegiste).', go: 'rendicion' });
  return L;
};
SC.inicio = function () {
  const S = App.S, hoy = App.hoy(), cur = C.enCurso(S);
  const sum = (a, f) => a.reduce((x, c) => x + f(c), 0);
  const cj = C.cajas(S), R = C.radiografia(S, hoy);
  const dias = App.ui.periodoDias || 30;
  const P = C.periodo(S, hoy, dias);
  const pct = (v) => (v == null ? '—' : C.pct(v, 1));
  const nodes = [];
  nodes.push(h('div', { class: 'bloque-t ahora' }, 'AHORA', h('span', { class: 'small' }, ' · lo que está en curso')));
  nodes.push(h('div', { class: 'grid2' },
    h('button', { type: 'button', class: 'card caja tap' + (cj.disp < 0 ? ' neg' : ''), onclick: () => App.go('dinero'), 'aria-label': 'Disponible para colocar. Ver plata' },
      h('div', { class: 'mut small' }, 'Disponible para colocar'), h('div', { class: 'big num' }, $(cj.disp))),
    h('button', { type: 'button', class: 'card caja tap' + (cj.cobr > 0 ? ' pend' : ''), onclick: () => App.go('dinero'), 'aria-label': 'Cobrado por asignar. Ver plata' },
      h('div', { class: 'mut small' }, 'Cobrado por asignar'), h('div', { class: 'big num' }, $(cj.cobr)))));
  nodes.push(h('p', { class: 'mut small' }, 'Cobrado por asignar: plata que entró por cobros y todavía no decidiste qué hacer con ella.'));
  nodes.push(h('div', { class: 'grid3' },
    UI.btn('Agregar capital', 'pri xl', () => App.abrirMov('capital')),
    UI.btn('Nueva rendición', 'pri xl', () => App.go('rendicion')),
    UI.btn('Mover plata', 'pri xl', () => App.go('dinero'))));
  nodes.push(h('div', { class: 'grid2', style: null }, UI.btn('Radiografía', 'ghost sm', () => App.go('radiografia')), UI.btn('Respaldo', 'ghost sm', () => App.go('respaldo')),
    UI.btn('Configuración', 'ghost sm', () => App.go('config')), UI.btn('Bloquear ahora', 'ghost sm', App.lockNow)));
  App.alertas().forEach((a) => nodes.push(h('div', { class: 'alert ' + a.cls }, h('div', { class: 'row' }, h('div', { class: 'grow' }, a.txt), a.go ? UI.btn('Ver', 'sm ghost', () => App.go(a.go)) : null))));
  if (cj.disp < 0) nodes.push(h('div', { class: 'alert warn' }, 'El disponible para colocar está en negativo: falta cargar capital o pasar plata desde «Cobrado por asignar».'));
  nodes.push(h('div', { class: 'stats', style: null },
    App.stat('Colocado en curso · ' + cur.length + (cur.length === 1 ? ' colocación' : ' colocaciones'), $(R.colocado), 'ahora'),
    App.stat('Total a devolverse', $(sum(cur, (c) => c.total)), 'ahora'),
    App.stat('Ganancia neta a cobrar', $(R.netaXC), 'ahora'),
    App.stat('Plazo promedio', R.plazoCur == null ? '—' : C.fmt(R.plazoCur, 0) + ' días', 'ahora'),
    App.stat('Rinde mensual (en curso)', pct(R.tasaNetaCur), 'ahora'),
    App.stat('Por devolver al proveedor', $(Math.max(0, R.finPend)), 'ahora')));

  // Período
  const fila = (k, a, b) => h('tr', null, h('td', null, k), h('td', { class: 'num' }, a), h('td', { class: 'num' }, b));
  const dif = P.delta == null ? 'sin datos del período anterior' : (P.delta >= 0 ? '▲ +' : '▼ ') + C.fmt(P.delta, 1) + '% (' + (P.act.neta - P.prev.neta >= 0 ? '+' : '') + $(P.act.neta - P.prev.neta) + ')';
  nodes.push(h('div', { class: 'card ahora' },
    h('div', { class: 'row sp' }, h('strong', null, 'Últimos ' + dias + ' días'), h('span', { class: 'mut small' }, C.fmtDM(P.desde) + ' al ' + C.fmtDM(P.hasta))),
    h('div', { class: 'chips' }, [7, 30, 60, 90].map((d) => h('button', { type: 'button', class: 'chip' + (d === dias ? ' on' : ''), onclick: () => { App.ui.periodoDias = d; App.render(); } }, d + ' días'))),
    h('div', { class: 'mut small' }, 'Ganado (la ganancia repartida día por día)'),
    h('div', { class: 'big num' }, $(P.act.neta)),
    h('div', null, 'Rinde ', h('strong', null, pct(P.act.rinde)), ' mensual sobre ' + $(P.act.capProm) + ' colocados en promedio'),
    h('div', { class: 'mut small' }, 'Contra los ' + dias + ' días anteriores: ' + dif),
    h('div', { class: 'live' },
      h('div', null, 'Cobrado en el período (ganancia neta que efectivamente entró): ', h('strong', null, $(P.cobrado.neta)), ' · ' + P.cobrado.cant + (P.cobrado.cant === 1 ? ' colocación' : ' colocaciones')),
      h('div', null, 'A cobrar en los próximos ' + dias + ' días: ', h('strong', null, $(P.proximos.total)), ' (ganancia neta ' + $(P.proximos.neta) + ') · ' + P.proximos.cant + (P.proximos.cant === 1 ? ' colocación' : ' colocaciones') + (P.proximos.vencidas ? ', ' + P.proximos.vencidas + ' vencida' + (P.proximos.vencidas === 1 ? '' : 's') : '')),
      h('div', null, 'Gastos del período (aparte, no restan al rendimiento): ', h('strong', null, $(P.gastos)))),
    h('table', null, h('thead', null, h('tr', null, ['', 'Propio', 'Financiado'].map((t) => h('th', null, t)))),
      h('tbody', null,
        fila('Capital promedio', $(P.act.Propio.capProm), $(P.act.Financiado.capProm)),
        fila('Ganado', $(P.act.Propio.neta), $(P.act.Financiado.neta)),
        fila('Rinde mensual', pct(P.act.Propio.rinde), pct(P.act.Financiado.rinde)),
        fila('Costo del financiamiento', '—', $(P.act.Financiado.costo))))));

  // Histórico
  nodes.push(h('div', { class: 'bloque-t hist' }, 'HISTÓRICO', h('span', { class: 'small' }, ' · lo ya cobrado, desde que empezaste')));
  nodes.push(h('div', { class: 'stats', style: null },
    App.stat('Colocaciones cobradas', String(R.nCob), 'hist'),
    App.stat('Capital que pasó por ellas', $(R.capCob), 'hist'),
    App.stat('Ganancia neta cobrada', $(R.netaCobrada), 'hist'),
    App.stat('Rinde mensual (cobradas)', pct(R.tasaNetaCob), 'hist'),
    App.stat('Plazo promedio', R.plazoCob == null ? '—' : C.fmt(R.plazoCob, 0) + ' días', 'hist'),
    App.stat('Retirado · Gastos', $(R.retiros) + ' · ' + $(R.gastos), 'hist')));

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

/* ---------- Plata: las dos cajas ---------- */
const CAJA_TXT = { disp: 'Disponible para colocar', cobr: 'Cobrado por asignar' };
const TIT_KIND = { pasar: 'Pasar a colocar', apartar: 'Apartar plata', capital: 'Agregar capital' };
function cajaDeMov(m) {
  if (m.tipo === 'Pasado a colocar') return 'Cobrado → Disponible';
  if (m.tipo === 'Aporte' || m.tipo === 'Financiamiento recibido' || m.tipo === 'Colocado') return CAJA_TXT.disp;
  return CAJA_TXT[m.caja === 'cobr' ? 'cobr' : 'disp'];
}
/* Ventana para pasar plata, apartarla o agregar capital (nuevo o editando). */
App.abrirMov = function (kind, mov, despues) {
  const S = App.S;
  UI.modal((close) => {
    const cj = C.cajas(S, mov ? mov.id : null);
    const R = C.radiografia(S, App.hoy());
    const fmtN = (v) => C.fmt(v, Math.floor(v) === v ? 0 : 2);
    const impIn = UI.num(mov ? fmtN(mov.imp) : (kind === 'pasar' && cj.cobr > 0 ? fmtN(cj.cobr) : ''));
    const fecha = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: C.fmtDate(mov ? mov.fecha : App.hoy()) });
    const nota = h('input', { type: 'text', autocomplete: 'off', value: mov ? mov.nota : '' });
    const err = h('div'), box = h('div');
    let cajaSel = null, destSel = null, origenSel = null;
    const campos = [];
    if (kind === 'apartar') {
      const cajaIni = mov ? (mov.caja === 'cobr' ? 'cobr' : 'disp') : (cj.cobr > 0 ? 'cobr' : 'disp');
      cajaSel = UI.sel([['cobr', 'Cobrado por asignar (' + $(cj.cobr) + ')'], ['disp', 'Disponible para colocar (' + $(cj.disp) + ')']], cajaIni);
      const destIni = mov ? (mov.destino || (mov.tipo === 'Pago de financiamiento' ? 'Proveedor' : mov.tipo === 'Gasto' ? 'Gastos' : 'Retiro mío')) : 'Proveedor';
      destSel = UI.sel(C.DESTINOS.map((d) => d[0]), destIni, () => hint());
      campos.push(UI.field('¿De dónde sale la plata?', cajaSel), UI.field('¿Para qué?', destSel));
    }
    if (kind === 'capital') {
      origenSel = h('input', { type: 'checkbox', checked: !!(mov && mov.tipo === 'Financiamiento recibido') });
      campos.push(h('label', { class: 'chk' }, origenSel, 'Es plata prestada por el proveedor (hay que devolverla)'));
    }
    const hintBox = h('div', { class: 'small' });
    const hint = () => {
      if (kind !== 'apartar') return;
      if (destSel.value === 'Proveedor') {
        hintBox.replaceChildren(h('div', { class: 'alert info' }, 'Por devolver al proveedor: ', h('strong', null, $(R.finPend)), ' ', UI.btn('Usar ese monto', 'sm ghost', () => { impIn.value = C.fmt(Math.max(0, R.finPend), Math.floor(R.finPend) === R.finPend ? 0 : 2); })));
      } else hintBox.replaceChildren();
    };
    hint();
    const info = {
      pasar: 'Pasa plata de «Cobrado por asignar» a «Disponible para colocar», para ponerla a trabajar.',
      apartar: 'Saca plata de una caja para el proveedor, gastos o un retiro tuyo. Queda anotado con su nota.',
      capital: 'Suma a «Disponible para colocar». No es ganancia. Si te la prestó el proveedor, tildalo y queda anotada como deuda. No cargues acá plata que ya viene de un cobro.'
    }[kind];
    const guardar = async () => {
      const o = { kind, imp: C.parseNum(impIn.value), fecha: C.parseEntrega(fecha.value, App.hoy()), nota: nota.value.trim() };
      if (kind === 'apartar') { o.caja = cajaSel.value; o.destino = destSel.value; }
      if (kind === 'capital') o.origen = origenSel.checked ? 'proveedor' : 'mio';
      const e = C.validarMov(S, o, mov);
      if (e) { err.replaceChildren(errBox([e])); return; }
      C.guardarMov(S, o, mov);
      await App.commit(true);
      const c2 = C.cajas(S);
      if (mov || kind === 'apartar') { close(); UI.toast('Guardado. Disponible: ' + $(c2.disp) + ' · Por asignar: ' + $(c2.cobr)); App.render(); return; }
      box.replaceChildren(h('div', null,
        h('div', { class: 'alert ok' }, h('strong', null, 'Listo.'), h('div', null, 'Disponible para colocar: ' + $(c2.disp)), h('div', null, 'Cobrado por asignar: ' + $(c2.cobr))),
        h('div', { class: 'grid2' }, UI.btn('Colocar ahora', 'pri', () => { close(); App.go('rendicion'); }), UI.btn('Cerrar', 'ghost', () => { close(); App.render(); }))));
      App.render();
    };
    box.appendChild(h('div', null, h('h2', null, (mov ? 'Editar · ' : '') + TIT_KIND[kind]), h('p', { class: 'mut small' }, info),
      campos, hintBox, UI.field('Importe', impIn), UI.field('Fecha', fecha), UI.field('Nota (opcional)', nota), err,
      h('div', { class: 'grid2', style: null }, UI.btn('Cancelar', 'ghost', close), UI.btn('Guardar', 'pri', guardar))));
    return box;
  });
};

SC.dinero = function () {
  const S = App.S, cj = C.cajas(S), R = C.radiografia(S, App.hoy()), f = App.ui.movFiltro || 'Todos';
  const movs = S.movs.filter((m) => f === 'Todos' || m.tipo === f).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  return {
    title: 'Plata', back: 'inicio',
    body: h('div', null,
      h('div', { class: 'grid2' },
        h('div', { class: 'card caja' + (cj.disp < 0 ? ' neg' : '') }, h('div', { class: 'mut small' }, 'Disponible para colocar'), h('div', { class: 'big num' }, $(cj.disp)), h('div', { class: 'mut small' }, 'Lo que vas a poner a trabajar.')),
        h('div', { class: 'card caja' + (cj.cobr > 0 ? ' pend' : '') }, h('div', { class: 'mut small' }, 'Cobrado por asignar'), h('div', { class: 'big num' }, $(cj.cobr)), h('div', { class: 'mut small' }, 'Entró por cobros. Vos decidís qué hacer.'))),
      cj.disp < 0 ? h('div', { class: 'alert warn' }, 'El disponible para colocar está en negativo. Falta cargar capital o pasar plata desde «Cobrado por asignar».') : null,
      cj.cobr < 0 ? h('div', { class: 'alert warn' }, 'Cobrado por asignar está en negativo: se apartó más de lo cobrado. Revisá los movimientos.') : null,
      R.finPend > 0.5 || R.deuda > 0.5 ? h('div', { class: 'alert info' }, 'Por devolver al proveedor: ', h('strong', null, $(R.finPend)), h('div', { class: 'small' }, 'Capital recibido que no devolviste, más el interés.')) : null,
      h('div', { class: 'grid3', style: null },
        UI.btn('Pasar a colocar', 'pri', () => App.abrirMov('pasar')), UI.btn('Apartar', '', () => App.abrirMov('apartar')), UI.btn('Agregar capital', '', () => App.abrirMov('capital'))),
      h('details', null, h('summary', { class: 'btn ghost full', style: null }, '¿Cómo funciona?'),
        h('div', { class: 'card small' },
          h('p', null, h('strong', null, 'Cobrar'), ' no mueve nada solo: el total cobrado cae en «Cobrado por asignar».'),
          h('p', null, h('strong', null, 'Pasar a colocar'), ' lo lleva a «Disponible para colocar» (lo que sobra sin colocar se arrastra solo).'),
          h('p', null, h('strong', null, 'Apartar'), ' lo saca para el proveedor, gastos o un retiro tuyo.'),
          h('p', null, h('strong', null, 'Agregar capital'), ' es solo para plata que viene de afuera.'))),
      h('label', { class: 'f' }, 'Filtrar movimientos por tipo'),
      UI.sel(['Todos'].concat(C.TIPOS), f, (e) => { App.ui.movFiltro = e.target.value; App.render(); }),
      h('h2', null, 'Movimientos'),
      movs.length ? movs.map((m) => {
        const entra = m.tipo === 'Aporte' || m.tipo === 'Financiamiento recibido' || m.tipo === 'Cobro';
        const signo = m.tipo === 'Pasado a colocar' ? '→ ' : entra ? '+' : '−';
        const col = m.colId ? S.cols.find((x) => x.id === m.colId) : null;
        return h('div', { class: 'card' },
          h('div', { class: 'row sp' }, h('strong', null, m.tipo + (m.destino && m.tipo !== 'Pago de financiamiento' ? ' · ' + m.destino : '')), h('strong', { class: 'num' }, signo + $(m.imp))),
          h('div', { class: 'mut small' }, C.fmtDate(m.fecha) + ' · ' + cajaDeMov(m) + (m.auto ? ' · automático' : '') + (col ? ' · N° ' + col.n : '') + (m.nota ? ' · ' + m.nota : '')),
          !m.auto ? h('div', { class: 'row', style: null }, UI.btn('Editar', 'sm', () => App.abrirMov(C.kindDe(m), m)), UI.btn('Borrar', 'sm bad', async () => {
            if (await UI.confirm('¿Borrar este movimiento de ' + $(m.imp) + '?', { ok: 'Borrar', danger: true })) { S.movs = S.movs.filter((x) => x !== m); await App.commit(); }
          })) : null);
      }) : h('p', { class: 'mut' }, 'Todavía no hay movimientos.'))
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
      tbl([row('Disponible para colocar', $(R.sinColocar)), row('Cobrado por asignar', $(R.porAsignar)), row('Colocado en curso', $(R.colocado)), row('   · Propio', $(R.colPropio)), row('   · Financiado', $(R.colFin)),
        row('Capital propio en juego', $(R.capPropioJuego)), row('% de capital propio colocado', R.pctPropio == null ? '—' : C.pct(R.pctPropio)),
        row('Por devolver al proveedor', $(R.finPend))]),
      h('h2', null, 'B. Acumulados'),
      tbl([row('Aportes acumulados', $(R.aportes)), row('Ganancia neta cobrada', $(R.netaCobrada)), row('Retiros acumulados', $(R.retiros)), row('Gastos acumulados', $(R.gastos)), row('Pasado a colocar acumulado', $(R.pasado)),
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
        h('thead', null, h('tr', null, ['Mes', 'Aportes', 'Colocado', 'Cobrado', 'Neta', 'Retirado', 'Gastos', 'Pasado'].map((t) => h('th', null, t)))),
        h('tbody', null, R.meses.map((m) => h('tr', null, h('td', null, m.mes.slice(5) + '/' + m.mes.slice(0, 4)), [m.aportes, m.colocado, m.cobrado, m.neta, m.retirado, m.gastos, m.pasado].map((v) => h('td', { class: 'num' }, C.fmt(Math.round(v))))))))) : null,
      h('h2', null, 'E. Cobros de las próximas 8 semanas'),
      R.vencidas.cant ? h('div', { class: 'alert bad' }, 'Vencidas sin cobrar: ' + R.vencidas.cant + ' · capital ' + $(R.vencidas.cap) + ' · total ' + $(R.vencidas.total) + ' · neta ' + $(R.vencidas.neta)) : null,
      h('div', { class: 'tscroll' }, h('table', null,
        h('thead', null, h('tr', null, ['Semana', 'Cant.', 'Capital', 'Total', 'Neta'].map((t) => h('th', null, t)))),
        h('tbody', null, R.semanas.map((w) => h('tr', null, h('td', null, C.fmtDM(w.desde) + '–' + C.fmtDM(w.hasta)), [C.fmt(w.cant), C.fmt(Math.round(w.cap)), C.fmt(Math.round(w.total)), C.fmt(Math.round(w.neta))].map((v) => h('td', { class: 'num' }, v))))))),
      h('h2', null, 'F. Cuadre'),
      R.cuadreOk ? h('div', { class: 'alert ok' }, h('strong', null, 'Cuadre OK'))
        : h('div', { class: 'alert bad' }, h('strong', null, 'Diferencia de ' + $(R.cuadreDif)), h('div', { class: 'small' }, 'La plata (las dos cajas) + lo colocado − lo que se debe al proveedor (' + $(R.cuadreIzq) + ') debería ser igual a aportes + ganancia neta cobrada − retiros − gastos (' + $(R.cuadreDer) + '). No se corrigió nada.'), UI.btn('Ver movimientos', 'sm', () => App.go('dinero'))))
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
      txt('costo', 'Costo mensual del capital financiado (%)'), txt('reinv', '% de reinversión (solo para la Calculadora)'), txt('redondeo', 'Múltiplo de redondeo para totales estimados'),
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

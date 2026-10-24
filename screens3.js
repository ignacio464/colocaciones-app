/* Calculadora: simulación de ciclos, comparador y grilla de sensibilidad. No guarda nada en los datos reales. */
(function (root) {
'use strict';
const C = root.Core, UI = root.UI, App = root.App, h = UI.h, $ = C.money;
const SC = App.screens;

function base() {
  const cfg = App.S.cfg;
  return { capital: '', plazo: '30', tarifa: 'Propia', tasaManual: '', origen: 'Propio', reinv: String(cfg.reinv != null ? cfg.reinv : 0).replace('.', ','), recolocar: '0', extra: '', extraCiclo: '2', modo: 'ciclos', nCiclos: '3', horizonte: '90' };
}
function cs() {
  if (!App.ui.calc) App.ui.calc = { esc: [base()], sel: 0, plazos: ['10', '15', '20', '30', '35'], porDia: false };
  return App.ui.calc;
}
function parse(e) {
  const P = C.parseNum, err = [];
  const o = {
    capital: P(e.capital), plazo: C.parseInt(e.plazo), tarifa: e.tarifa, tasaManual: P(e.tasaManual), origen: e.origen, reinv: P(e.reinv),
    recolocar: C.parseInt(e.recolocar || '0'), extra: e.extra.trim() === '' ? 0 : P(e.extra), extraCiclo: C.parseInt(e.extraCiclo || '2'),
    modo: e.modo, nCiclos: C.parseInt(e.nCiclos), horizonte: C.parseInt(e.horizonte)
  };
  if (!(o.capital > 0)) err.push('Ingresá un capital mayor que 0.');
  if (!(o.plazo >= 1)) err.push('El plazo debe ser un entero de 1 día o más.');
  if (o.tarifa === 'Manual' && !(o.tasaManual >= 0)) err.push('Ingresá la tasa mensual para la tarifa Manual.');
  if (!(o.reinv >= 0 && o.reinv <= 100)) err.push('El % de reinversión debe estar entre 0 y 100.');
  if (!(o.recolocar >= 0)) err.push('Los días hasta recolocar deben ser 0 o más.');
  if (!(o.extra >= 0)) err.push('El aporte extra no es válido.');
  if (o.extra > 0 && !(o.extraCiclo >= 1)) err.push('Indicá en qué ciclo entra el aporte extra.');
  if (o.modo === 'ciclos' && !(o.nCiclos >= 1 && o.nCiclos <= 36)) err.push('La cantidad de ciclos debe estar entre 1 y 36.');
  if (o.modo === 'horizonte' && !(o.horizonte >= 1)) err.push('El horizonte debe ser de 1 día o más.');
  return { o, err };
}
const NAMES = ['Base', 'Variante 1', 'Variante 2', 'Variante 3'];

SC.calculadora = function () {
  const S = App.S, st = cs(), cfg = S.cfg;
  if (!cfg.ok) return { title: 'Calculadora', body: h('div', { class: 'alert warn' }, 'Primero cargá la configuración.') };
  const e = st.esc[st.sel];
  const inp = (k, opts) => { const i = UI.num(e[k], Object.assign({ fmt: false }, opts)); i.addEventListener('input', () => { e[k] = i.value; paint(); }); return i; };
  const sel = (k, list) => UI.sel(list, e[k], (ev) => { e[k] = ev.target.value; App.render(); });
  const out = h('div'), cmp = h('div'), sens = h('div');
  const paint = () => {
    const r = parse(e);
    if (r.err.length) { out.replaceChildren(h('div', { class: 'alert warn' }, r.err.map((x) => h('div', null, x)))); }
    else {
      const sim = C.simular(r.o, cfg), T = sim.T;
      out.replaceChildren(h('div', null,
        T.n === 0 ? h('div', { class: 'alert warn' }, 'Con ese horizonte no entra ningún ciclo completo.') : null,
        T.sobrantes > 0 ? h('div', { class: 'alert info' }, 'Sobran ' + T.sobrantes + ' días sin colocar.') : null,
        h('div', { class: 'stats' },
          App.stat('Ganancia neta total', $(T.neta)), App.stat('Retiro total', $(T.retiro)), App.stat('Capital final', $(T.capFinal)), App.stat('Aportes extra', $(T.extra)),
          App.stat('Días totales', String(T.dias)), App.stat('Ganancia neta por día', $(T.netaDia))),
        T.n ? h('div', { class: 'tscroll' }, h('table', null,
          h('thead', null, h('tr', null, ['Ciclo', 'Capital inicial', 'Aporte extra', 'Gan. bruta', 'Costo', 'Gan. neta', 'Retiro', 'Capital final'].map((t) => h('th', null, t)))),
          h('tbody', null, sim.rows.map((x) => h('tr', null, h('td', null, String(x.i)), [x.ini, x.extra, x.bruta, x.costo, x.neta, x.retiro, x.fin].map((v) => h('td', { class: 'num' }, C.fmt(Math.round(v))))))))) : null,
        h('div', { class: 'grid2', style: null },
          UI.btn('Usar en una rendición', 'pri', () => { App.ui.rendPrefill = { cap: r.o.capital, plazo: r.o.plazo, origen: r.o.origen }; App.go('rendicion'); }),
          UI.btn('Duplicar como variante', '', () => { if (st.esc.length >= 4) { UI.toast('Ya hay 3 variantes.'); return; } st.esc.push(Object.assign({}, e)); st.sel = st.esc.length - 1; App.render(); }))));
    }
    drawCmp(); drawSens();
  };
  const drawCmp = () => {
    if (st.esc.length < 2) { cmp.replaceChildren(h('p', { class: 'mut small' }, 'Duplicá el escenario como variante y cambiá algún dato para compararlo con el Base.')); return; }
    const res = st.esc.map((x) => { const r = parse(x); return r.err.length ? null : C.simular(r.o, cfg).T; });
    const b = res[0];
    let best = -1, bv = -Infinity;
    res.forEach((t, i) => { if (t && t.capFinal > bv) { bv = t.capFinal; best = i; } });
    const rows = [['Ganancia neta total', 'neta', $], ['Retiro total', 'retiro', $], ['Capital final', 'capFinal', $], ['Ganancia neta por día', 'netaDia', $], ['Tasa mensual efectiva', 'tasaEf', (v) => C.pct(v)]];
    cmp.replaceChildren(h('div', null, h('div', { class: 'tscroll' }, h('table', null,
      h('thead', null, h('tr', null, [''].concat(st.esc.map((x, i) => NAMES[i] + (i === best ? ' ★' : ''))).map((t, i) => h('th', { class: i - 1 === best ? 'best' : '' }, t)))),
      h('tbody', null, rows.map((rw) => h('tr', null, h('td', null, rw[0]), res.map((t, i) => {
        if (!t) return h('td', null, '—');
        const d = i > 0 && b ? t[rw[1]] - b[rw[1]] : null, p = d != null && b[rw[1]] ? d / Math.abs(b[rw[1]]) * 100 : null;
        return h('td', { class: 'num' + (i === best && rw[1] === 'capFinal' ? ' hl' : '') }, rw[2](t[rw[1]]), d != null ? h('div', { class: 'mut small' }, (d >= 0 ? '+' : '') + (rw[1] === 'tasaEf' ? C.fmt(d, 2) + ' pts' : $(d)) + (p != null ? ' (' + (p >= 0 ? '+' : '') + C.fmt(p, 1) + '%)' : '')) : null);
      })))))),
      best >= 0 && res.filter(Boolean).length > 1 ? h('p', { class: 'small' }, 'Mejor por capital final: ' + NAMES[best] + (best > 0 && b ? ' (' + $(res[best].capFinal - b.capFinal) + ' sobre el Base)' : '') + '.') : null));
  };
  const drawSens = () => {
    const r = parse(e);
    if (r.err.length) { sens.replaceChildren(); return; }
    const pl = st.plazos.map((x) => C.parseInt(x));
    if (pl.some((x) => !(x >= 1))) { sens.replaceChildren(h('div', { class: 'alert warn' }, 'Los plazos de la grilla deben ser enteros de 1 día o más.')); return; }
    const g = C.sensibilidad(r.o, cfg, pl, st.porDia);
    sens.replaceChildren(h('div', { class: 'tscroll' }, h('table', null,
      h('thead', null, h('tr', null, [h('th', null, 'Tasa \\ Plazo')].concat(pl.map((p) => h('th', null, p + ' d'))))),
      h('tbody', null, g.tasas.map((t, i) => h('tr', null, h('td', null, C.fmt(t, 1) + '%'), g.cel[i].map((v, j) => h('td', { class: 'num' + (i === 2 && pl[j] === r.o.plazo ? ' hl' : '') }, st.porDia ? C.fmt(Math.round(v)) : C.fmt(Math.round(v))))))))));
  };
  const tabs = h('div', { class: 'chips' }, st.esc.map((x, i) => h('button', { type: 'button', class: 'chip' + (st.sel === i ? ' on' : ''), onclick: () => { st.sel = i; App.render(); } }, NAMES[i])),
    st.esc.length > 1 && st.sel > 0 ? UI.btn('Quitar esta variante', 'sm ghost', () => { st.esc.splice(st.sel, 1); st.sel = 0; App.render(); }) : null);
  const plazosRow = h('div', { class: 'row wrap' }, st.plazos.map((p, j) => { const i = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: p, 'aria-label': 'Plazo de la grilla ' + (j + 1), oninput: (ev) => { st.plazos[j] = ev.target.value; drawSens(); } }); return h('div', { style: null, class: 'grow' }, i); }));
  const body = h('div', null,
    h('div', { class: 'alert info small' }, 'Simulación con interés proporcional a los días; para el valor exacto de la tabla usá Rendición.'),
    tabs,
    h('div', { class: 'card' },
      UI.field('Capital', inp('capital', { ph: '$' })), UI.field('Plazo (días)', inp('plazo', { int: true })),
      h('div', { class: 'grid2' }, UI.field('Tarifa', sel('tarifa', ['Propia', 'Tabla', 'Manual'])), UI.field('Origen', sel('origen', ['Propio', 'Financiado']))),
      e.tarifa === 'Manual' ? UI.field('Tasa mensual (%)', inp('tasaManual')) : h('div', { class: 'mut small' }, 'Tasa mensual: ' + C.pct(e.tarifa === 'Propia' ? cfg.tasa_propia : cfg.tasa_tabla, 2)),
      UI.field('% de ganancia neta que se reinvierte', inp('reinv')),
      h('div', { class: 'grid2' }, UI.field('Días hasta recolocar', inp('recolocar', { int: true })), UI.field('Aporte extra ($)', inp('extra'))),
      UI.field('El aporte extra entra antes del ciclo', inp('extraCiclo', { int: true })),
      UI.field('Duración', sel('modo', [['ciclos', 'Cantidad de ciclos'], ['horizonte', 'Horizonte en días']])),
      e.modo === 'ciclos' ? UI.field('Cantidad de ciclos (1 a 36)', inp('nCiclos', { int: true })) : UI.field('Horizonte (días)', inp('horizonte', { int: true }))),
    h('h2', null, 'Resultado · ' + NAMES[st.sel]), out,
    h('h2', null, 'Comparador'), cmp,
    h('h2', null, 'Sensibilidad (ganancia neta de un ciclo)'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: st.porDia, onchange: (ev) => { st.porDia = ev.target.checked; drawSens(); } }), 'Ver ganancia neta por día'),
    h('div', { class: 'mut small' }, 'Plazos de la grilla (editables):'), plazosRow, sens);
  paint();
  return { title: 'Calculadora', body };
};
})(window);

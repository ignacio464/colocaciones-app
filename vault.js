/* Almacenamiento cifrado en reposo: AES-GCM 256 + PBKDF2-SHA256. La clave vive solo en memoria. */
(function (root) {
'use strict';
const KEY = 'sf1';
const ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
let key = null, salt = null, iter = ITER, queue = Promise.resolve();

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derive(pw, s, it) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: s, iterations: it }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, obj) {
  const iv = rnd(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), c: b64(new Uint8Array(ct)) };
}
async function open(k, iv, c) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(c));
  return JSON.parse(dec.decode(pt));
}
function validEnv(e) {
  return e && typeof e === 'object' && e.v === 1 && typeof e.s === 'string' && typeof e.iv === 'string' && typeof e.c === 'string' && Number.isInteger(e.i) && e.i >= 1e3 && e.i <= 1e7;
}

const V = {};
V.supported = () => !!(root.crypto && root.crypto.subtle && root.isSecureContext !== false);
V.exists = () => { try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; } };
V.unlocked = () => key !== null;

V.create = async function (pw, state) {
  salt = rnd(16); iter = ITER;
  key = await derive(pw, salt, iter);
  await V.save(state);
};
V.unlock = async function (pw) {
  const e = JSON.parse(localStorage.getItem(KEY));
  if (!validEnv(e)) throw new Error('formato');
  const s = unb64(e.s);
  const k = await derive(pw, s, e.i);
  const state = await open(k, e.iv, e.c); // lanza error si la contraseña es incorrecta
  key = k; salt = s; iter = e.i;
  return state;
};
V.save = function (state) {
  if (!key) return Promise.reject(new Error('bloqueado'));
  const snap = JSON.stringify(state); // instantánea síncrona: lo guardado es lo que había al llamar
  queue = queue.then(async () => {
    const p = await seal(key, JSON.parse(snap));
    localStorage.setItem(KEY, JSON.stringify({ v: 1, s: b64(salt), i: iter, iv: p.iv, c: p.c }));
  });
  return queue;
};
V.verify = async function (pw) {
  const e = JSON.parse(localStorage.getItem(KEY));
  const k = await derive(pw, unb64(e.s), e.i);
  await open(k, e.iv, e.c);
  return true;
};
V.changePassword = async function (oldPw, newPw, state) {
  await V.verify(oldPw);
  const before = JSON.parse(localStorage.getItem(KEY));
  salt = rnd(16); iter = ITER;
  key = await derive(newPw, salt, iter);
  await V.save(state);
  return { saltChanged: before.s !== b64(salt) };
};
V.lock = function () { key = null; salt = null; };

/* Respaldo cifrado con clave propia (misma o distinta de la contraseña de la app). */
V.exportEnc = async function (state, pw) {
  const s = rnd(16), k = await derive(pw, s, ITER);
  const p = await seal(k, state);
  return JSON.stringify({ app: 'sanfra-respaldo', v: 1, s: b64(s), i: ITER, iv: p.iv, c: p.c });
};
V.isEnc = (text) => { try { const o = JSON.parse(text); return !!(o && o.app === 'sanfra-respaldo' && validEnv(o)); } catch (e) { return false; } };
V.importEnc = async function (text, pw) {
  const o = JSON.parse(text);
  if (!validEnv(o)) throw new Error('formato');
  const k = await derive(pw, unb64(o.s), o.i);
  return open(k, o.iv, o.c); // error si la clave es incorrecta; no toca nada
};

/* Destrucción total de lo que la app pudo dejar en el navegador. */
V.destroyAll = async function () {
  V.lock();
  try { localStorage.clear(); } catch (e) { /* nada */ }
  try { sessionStorage.clear(); } catch (e) { /* nada */ }
  try {
    if (root.indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map((d) => new Promise((ok) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => ok(); })));
    }
  } catch (e) { /* nada */ }
  try {
    if (root.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
  } catch (e) { /* nada */ }
  try {
    if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); }
  } catch (e) { /* nada */ }
};

root.Vault = V;
})(window);

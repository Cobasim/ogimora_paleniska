// Kod konfiguracji: każda kombinacja ustawień ↔ jeden krótki kod, np. 4K7QMX-9XD4TB-8C2AQ.
// Budowa: [wersja modelu][15 znaków: liczba w systemie mieszanym][2 znaki sumy kontrolnej].
// Alfabet Crockford base32 (bez I, L, O, U) — nie myli się 0/O ani 1/I/L przy przepisywaniu.
import { PARAMS, THICKNESSES, PERF_LEVELS } from './geometry.js';

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = '9'; // PROSTY v9: wysokość ścianek i dna co 5 mm (suwaki mają krok 5 – przy kroku 10 kod zaokrąglał np. 55 → 60);
// v8: // PROSTY v8: + wysokość nóżek (legCut); // v7: misa gięta w całości (bowlBent 0/1/2); v6: + „nogi z boków” i kształt wycięcia; kody v5 i v6 nadal się wczytują

// Kolejność pól jest częścią formatu — nie zmieniać bez podniesienia VERSION.
const FIELDS = [
  ...PARAMS.map(p => ({ id: p.id, n: Math.round((p.max - p.min) / p.step) + 1,
    enc: v => Math.round((v - p.min) / p.step), dec: i => Math.round((p.min + i * p.step) * 1000) / 1000 })),
  { id: 'tBowl', n: THICKNESSES.length, enc: v => Math.max(0, THICKNESSES.indexOf(v)), dec: i => THICKNESSES[i] },
  { id: 'tLeg', n: THICKNESSES.length, enc: v => Math.max(0, THICKNESSES.indexOf(v)), dec: i => THICKNESSES[i] },
  { id: 'mat', n: 2, enc: v => v ? 1 : 0, dec: i => i },
  { id: 'bowlBent', n: 2, enc: v => v ? 1 : 0, dec: i => i },
  { id: 'legBent', n: 2, enc: v => v ? 1 : 0, dec: i => i },
  { id: 'perfBowl', n: PERF_LEVELS.length, enc: v => v | 0, dec: i => i },
  { id: 'perfLeg', n: PERF_LEVELS.length, enc: v => v | 0, dec: i => i },
];
const FIELDS_V5 = FIELDS.slice();
FIELDS.push(
  { id: 'skirt', n: 2, enc: v => v ? 1 : 0, dec: i => i },
  { id: 'skirtArch', n: 2, enc: v => v ? 1 : 0, dec: i => i },
);
const FIELDS_V6 = FIELDS.slice();
FIELDS.splice(FIELDS.findIndex(f => f.id === 'bowlBent'), 1, { id: 'bowlBent', n: 3, enc: v => Math.round(+v) || 0, dec: i => i });
const FIELDS_V7 = FIELDS.slice();
// PROSTY v8: bok dna co 5 mm (dno przesuwa się wewnątrz stałej bryły, więc jego bok zmienia się płynnie)
FIELDS.splice(FIELDS.findIndex(f => f.id === 'base'), 1, { id: 'base', n: 151, enc: v => Math.round((v - 150) / 5), dec: i => 150 + i * 5 });
FIELDS.push({ id: 'legCut', n: 61, enc: v => Math.round((+v || 0) / 5), dec: i => i * 5 });   // 0…300 mm co 5
const FIELDS_V8 = FIELDS.slice();
FIELDS.splice(FIELDS.findIndex(f => f.id === 'height'), 1, { id: 'height', n: 71, enc: v => Math.round((v - 100) / 5), dec: i => 100 + i * 5 });        // 100…450 co 5
FIELDS.splice(FIELDS.findIndex(f => f.id === 'legHeight'), 1, { id: 'legHeight', n: 101, enc: v => Math.round((+v || 0) / 5), dec: i => i * 5 });   // 0…500 co 5
const BODY = 18;            // PROSTY v9: 18 znaków (v8: 17, v5–v7: 15)
const BODY_STARE = 15;
export const CODE_LENGTH = 1 + BODY + 2;

function checksum(s) {
  let a = 7, b = 3;
  for (const ch of s) { const v = ALPHA.indexOf(ch); a = (a * 31 + v + 1) % 1021; b = (b + a) % 1021; }
  return ALPHA[a % 32] + ALPHA[b % 32];
}

export function encode(state) {
  let n = 0n;
  for (const f of FIELDS) {
    const i = Math.min(f.n - 1, Math.max(0, f.enc(state[f.id])));
    n = n * BigInt(f.n) + BigInt(i);
  }
  let body = '';
  for (let k = 0; k < BODY; k++) { body = ALPHA[Number(n % 32n)] + body; n /= 32n; }
  const raw = VERSION + body;
  const full = raw + checksum(raw);
  return `${full.slice(0, 6)}-${full.slice(6, 12)}-${full.slice(12)}`; // 6-6-7
}

/** Zwraca obiekt parametrów albo null, gdy kod jest błędny (literówka, zła długość, stara wersja). */
export function decode(code) {
  const s = String(code).toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (!['5', '6', '7', '8', VERSION].includes(s[0])) return null;
  const BODY = s[0] === VERSION ? 18 : s[0] === '8' ? 17 : BODY_STARE;
  if (s.length !== 1 + BODY + 2) return null;
  const fields = s[0] === '5' ? FIELDS_V5 : s[0] === '6' ? FIELDS_V6 : s[0] === '7' ? FIELDS_V7 : s[0] === '8' ? FIELDS_V8 : FIELDS;
  const raw = s.slice(0, 1 + BODY);
  if (checksum(raw) !== s.slice(1 + BODY)) return null;
  let n = 0n;
  for (const ch of raw.slice(1)) { const v = ALPHA.indexOf(ch); if (v < 0) return null; n = n * 32n + BigInt(v); }
  const out = {};
  for (let k = fields.length - 1; k >= 0; k--) {
    const f = fields[k], i = Number(n % BigInt(f.n)); n /= BigInt(f.n);
    out[f.id] = f.dec(i);
  }
  if (n !== 0n) return null;
  if (s[0] === '5') { out.skirt = 0; out.skirtArch = 1; }
  return out;
}

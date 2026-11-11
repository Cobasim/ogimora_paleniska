// Szacunkowa wycena (PLN netto). Źródła i daty — README / komentarze poniżej.
// Wszystkie liczby to średnie orientacyjne z rynku PL (X 2026), do nadpisania w UI.

export const MATERIALS = {
  s235: {
    name: 'Stal czarna S235',
    short: 'S235',
    // hurt ~3,3–3,6 zł/kg (PUDS, IV 2026); przy małym zamówieniu w firmie tnącej zwykle 5–7 zł/kg
    pricePerKg: 6.5,   // z wycen wychodzi ok. 6,2 – zaokrąglone lekko w górę (decyzja użytkownika: ceny własne, orientacyjne, nie cudzy cennik)
    cutFactor: 1.0,
    finish: 'mill',
  },
  weather: {
    // „Corten” to zastrzeżona nazwa handlowa — używamy nazwy ogólnej i oznaczenia normy EN 10025-5.
    name: 'Stal patynująca S355J2W',
    short: 'S355J2W',
    // detal: ok. 16–22 zł/kg brutto (sklepy, arkusze 3 mm); netto przy arkuszu ~13 zł/kg
    pricePerKg: 13.0,
    cutFactor: 1.1, // stal o wyższej wytrzymałości — tnie się trochę wolniej
    finish: 'c_ripe',
  },
};

// DWIE PRAWDZIWE WYCENY Z POLSKI (11 XI 2026, podane przez użytkownika): serwis cięcia online, projekt startowy, blacha 5 mm (zł/szt.):
//   sztuk:           1        10       25
//   ze wzorami     392,95   263,71   255,75
//   bez wzorów     353,14   224,39   220,58
// Jak ta cena jest zbudowana (wynika z liczb): cena sztuki + stała obsługa zlecenia ok. 143 zł rozłożona na serię
//   (353,14 = 210 + 143; 224,39 = 210 + 143/10). Wzory (7,0 m cięcia, 120 przebić) kosztują ok. 39 zł niezależnie od ilości
//   → cięcie 5 mm ok. 3,1 zł/m i 0,15 zł za przebicie (podział według czasu: 5,2 m/min, 0,55 s na przebicie).
//   Reszta ceny sztuki bez wzorów (210 − 32 zł cięcia) to stal: 6,2 zł/kg z 25% odpadu.
// Poprzednie stawki (cennik ropuch.pl: 5 mm 7,2 zł/m, 0,25 zł/przebicie, przygotowanie 50 zł) dawały podobną sumę, ale źle podzieloną:
// wzory wychodziły 2× za drogo, a obsługa zlecenia 3× za tanio. Grubości 3, 4, 8, 10 mm: stawka 5 mm × proporcje z tamtego cennika (bez własnej wyceny).
// Nie wiem, czy wycena była netto czy brutto – przyjęte netto (tak zwykle podają zakłady).
export const CUT_RATES = {
  // stawki lekko zaokrąglone w górę względem wyliczonych z wycen (5 mm: 3,1 zł/m i 0,15 zł)
  3: [1.6, 0.10],
  4: [2.2, 0.13],
  5: [3.2, 0.16],
  8: [5.8, 0.27],
  10: [7.0, 0.34],
};

export const PRICE_DEFAULTS = {
  scrap: 25,        // % odpadu przy rozkroju (kupujesz więcej niż masa netto)
  setup: 150,       // obsługa zlecenia: przygotowanie produkcji, program, pakowanie (z wyceny: ok. 143 zł, zaokrąglone)
  bendPrice: 10,    // jedno gięcie na krawędziarce
  vat: 23,
};

// ---------------------------------------------------------------- rynek: PL (zł, netto + VAT) albo USA ($, bez podatku od sprzedaży)
// Wersja angielska strony liczy cenę według stawek amerykańskich – to OSOBNY szacunek, nie przeliczenie złotówek.
// Każda liczba poniżej ma źródło sprawdzone 11 XI 2026 (adresy w claude/STRONA_prosta_v11…); gdzie jest wyliczenie – napisane.
//
// STAL A36, blacha 3/16": cennik dystrybutorów 1,05 $/lb (materialpricebook.com, XI 2026); sklepy detaliczne: 1,57 $/lb
//   (dmsteel.com: 24×24" 48,20 $, 48×48" 192,76 $) i 2,00 $/lb (allmetalsinc.com: 48×48" 245,24 $).
//   Zakład kupuje u dystrybutora i dolicza 25% (narzut na materiał wg stylecnc.com i lapas) → 1,05 × 1,25 = 1,31 $/lb = 2,90 $/kg.
// STAL PATYNUJĄCA (A606 / A588): onlinemetals.com, ten sam sklep i ten sam najmniejszy format 3/16":
//   patynująca od 21,15 $, A36 18,15 $ → ×1,17 → 3,40 $/kg. (Jedno porównanie, najmniejszy format.)
// CIĘCIE – liczone z czasu maszyny, bo wiarygodnego cennika „za cal” w USA nie znalazłem (znalezione liczby różnią się 50×):
//   stawka lasera fiber 6 kW: 80–180 $/h, w przykładach 110–120 $/h (lapas-landing.pages.dev, cutquote.app; stylecnc.com: od 90 $/h) → 120 $/h = 2 $/min;
//   prędkość, stal miękka: 3 mm 8–10 m/min, 10 mm 2,2–2,8 m/min (te same źródła); 4, 5, 8 mm – interpolacja liniowa między nimi (WYLICZENIE);
//   dodatek na rozpędzanie, przejazdy i gaz: +36% (przykład z cutquote.app: 0,38 $ na 1,06 $ cięcia);
//   narzut przy pojedynczych sztukach: 50–100% (lapas) → przyjęte 100%;
//   przebicie: 1–3 mm 0,1–0,3 s, 4–6 mm 0,3–0,8 s, 8–10 mm 0,8–2,0 s (cutquote.app) × 2 $/min × 2;
//   przygotowanie: 40–80 $, w przykładach 50–60 $ (lapas, stylecnc, eminacademy) → 50 $.
// Uwaga: to koszt wyliczony, nie oferta. Prawdziwa wycena jednej sztuki bywa dużo wyższa (minimalne zamówienie, kolejka).
import { LANG } from './i18n.js';
export const RYNEK = LANG === 'en' ? 'us' : 'pl';
export const WALUTA = RYNEK === 'us' ? '$' : 'zł';
// DWIE PRAWDZIWE WYCENY (11 XI 2026, podane przez użytkownika): serwis cięcia online w USA, projekt startowy, A36 4,8 mm ($/szt.):
//   sztuk:                   1        2       10       50     100+
//   ze wzorami i otworami  379,51   273,39   201,07   152,70   151,36
//   bez wzorów i otworów   301,12   211,70   144,64   117,23   115,60
// Z różnicy (wzory = 7,0 m cięcia i 120 przebić, przy dużej serii 35,76 $) wychodzi stawka cięcia 5 mm: 2,81 $/m i 0,134 $/przebicie
// (podział między metry a przebicia według czasu: 5,2 m/min i 0,55 s na przebicie – ze źródeł powyżej).
// Reszta ceny seryjnej kształtu (115,60 − cięcie 29 $) to stal: wychodzi 2,94 $/kg z 25% odpadu – zgodnie z ceną ze źródeł (2,90).
// Przy dużej serii nie ma opłaty za przygotowanie. Cena przy q sztukach = a × cena seryjna + b (a, b dopasowane do obu wycen):
export const USA_SERIA = [[1, 2.2, 50], [2, 1.75, 13], [10, 1.6, -38], [50, 1, 3]];   // dopasowane: (2,192; 47,7) (1,725; 12,3) (1,578; −37,8) (0,992; 2,6) – tu lekko zaokrąglone w górę
export const usaCena = (seryjna, q = 1) => { const w = USA_SERIA.find(x => x[0] === q) || USA_SERIA[0]; return Math.max(0, w[1] * seryjna + w[2]); };
// Sprawdzenie na projekcie startowym (stal 3,0 $/kg): patrz claude/STRONA_prosta_v11… – model odtwarza obie wyceny z dokładnością ok. 1%.
// Grubości 3 i 4 mm (oraz 8, 10) NIE mają własnej wyceny: stawka 5 mm przeliczona czasem cięcia (prędkości i czasy przebicia ze źródeł).
if (RYNEK === 'us') {
  MATERIALS.s235.pricePerKg = 3.1; MATERIALS.weather.pricePerKg = 6.2;   // patynująca ×2 jak w PL – decyzja użytkownika („na razie nie wiadomo”); jedyne sprawdzone porównanie dawało ×1,17   // A36: 3,0 $/kg wynika z wycen (źródła: 2,90); patynująca ×1,17
  MATERIALS.weather.cutFactor = 1.0;
  const V = { 3: 9, 4: 8.1, 5: 7.1, 8: 4.4, 10: 2.5 };                    // m/min (4, 5, 8 mm – interpolacja)
  const TP = { 3: 0.2, 4: 0.55, 5: 0.55, 8: 1.4, 10: 1.4 };               // s na przebicie (środek widełek)
  const C5 = 2.9, P5 = 0.14;                                              // z wycen: 2,81 i 0,134 – lekko zaokrąglone w górę
  for (const t of Object.keys(V)) CUT_RATES[t] = [+(C5 * V[5] / V[t]).toFixed(2), +(P5 * TP[t] / TP[5]).toFixed(3)];   // [$/m, $/przebicie]
  Object.assign(PRICE_DEFAULTS, { setup: 0, bendPrice: 6, vat: 0 });
}
const pl = (v, d) => v.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });   // przecinek, jak w reszcie strony

export function estimate(model, material, opts = PRICE_DEFAULTS, overrides = {}) {
  const mat = MATERIALS[material];
  const kg = overrides.pricePerKg ?? mat.pricePerKg;
  const lines = [];
  let materialCost = 0, cutCost = 0, pierceCost = 0, bends = 0, mass = 0;
  for (const p of model.parts) {
    const [perM, perPierce] = CUT_RATES[p.t];
    const m = p.area * p.t * 7.85e-6 * p.qty;
    mass += m;
    materialCost += m * (1 + opts.scrap / 100) * kg;
    cutCost += p.perimeter / 1000 * perM * mat.cutFactor * p.qty;
    pierceCost += (p.pierces || 1) * perPierce * p.qty; // każdy kontur zamknięty (obrys, otwór) = jedno przebicie
    bends += (p.folds || []).length * p.qty;
  }
  const bendCost = bends * opts.bendPrice;
  lines.push(['Materiał', RYNEK === 'us' ? `${mass.toFixed(1)} kg (${(mass * 2.2046).toFixed(0)} lb) + ${opts.scrap}% scrap × $${kg.toFixed(2)}/kg` : `${pl(mass, 1)} kg + ${opts.scrap}% odpadu × ${pl(kg, 2)} zł/kg`, materialCost]);
  lines.push(['Cięcie laserem', RYNEK === 'us' ? `${(model.stats.cut / 1000).toFixed(1)} m (${(model.stats.cut / 304.8).toFixed(0)} ft)` : `${pl(model.stats.cut / 1000, 1)} m`, cutCost]);
  lines.push(['Przebicia', `${model.parts.reduce((s, p) => s + (p.pierces || 1) * p.qty, 0)} szt.`, pierceCost]);
  if (bends) lines.push(['Gięcie', `${bends} gięć`, bendCost]);
  lines.push(['Przygotowanie', 'obsługa zlecenia: program, przygotowanie, pakowanie', opts.setup]);
  const net = lines.reduce((s, l) => s + l[2], 0);
  return { lines, net, gross: net * (1 + opts.vat / 100), low: net * 0.8, high: net * 1.35 };
}

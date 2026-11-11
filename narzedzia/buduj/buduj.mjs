// OGIMORA – składa wersję do wgrania na serwer:  www/ (czytelne źródła)  →  wydanie/ (to idzie do FileZilli)
// Użycie (w folderze 3_OGIMORA_STRONA):   node narzedzia/buduj/buduj.mjs
// Pierwszy raz:   cd narzedzia/buduj && npm install
// Co robi: wszystkie skrypty strony skleja w jeden plik o nic niemówiącej nazwie, skraca nazwy, wyrzuca komentarze,
// ściska CSS, dopisuje podpis © OGIMORA. Wzory (wzory_dane/), czcionki, obrazki, api/ i proba/ kopiuje bez zmian.
// To utrudnia przerabianie cudzej kopii – nie uniemożliwia jej zrobienia.
import { build, transform } from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { wersjeJezykowe } from './jezyki.mjs';
const TU = path.dirname(fileURLToPath(import.meta.url));
const KORZEN = path.resolve(TU, '../..'), SRC = path.join(KORZEN, 'www'), OUT = path.join(KORZEN, 'wydanie');
const wersja = /WERSJA = '([^']+)'/.exec(fs.readFileSync(path.join(SRC, 'js/wersja.js'), 'utf8'))[1];
const rok = new Date().getFullYear();
const PODPIS = `/*! (c) ${rok} OGIMORA - ogimora.com - wersja ${wersja}. Wszelkie prawa zastrzezone / All rights reserved.\n    Kopiowanie, przerabianie i uruchamianie tej strony pod innym adresem jest zabronione.\n    Copying, modifying or hosting this site elsewhere is not permitted. Biblioteki obce / third-party: js/LICENCJE.txt */`;

// 1. czysty folder wydania (api/dane nigdy tu nie trafia)
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
const POMIN = new Set(['js', 'CZYTAJ.md', '.DS_Store']);
const kopiuj = (a, b) => { for (const e of fs.readdirSync(a, { withFileTypes: true })) {
  if (e.name === '.DS_Store' || (a === SRC && POMIN.has(e.name)) || (a === path.join(SRC, 'api') && e.name === 'dane')) continue;
  const x = path.join(a, e.name), y = path.join(b, e.name);
  if (e.isDirectory()) { fs.mkdirSync(y, { recursive: true }); kopiuj(x, y); } else fs.copyFileSync(x, y);
} };
kopiuj(SRC, OUT);

// 2. skrypty: kolejność jak w index.html → jeden plik
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const moduly = [...html.matchAll(/<script type="module" src="(js\/[^"]+)"><\/script>\s*/g)];
if (moduly.length < 2) throw new Error('index.html: nie znalazłem skryptów strony');
const start = path.join(TU, '_start.mjs');
fs.writeFileSync(start, moduly.map(m => `import ${JSON.stringify(path.join(SRC, m[1]))};`).join('\n') + '\n');
const wyn = await build({
  entryPoints: [start], bundle: true, format: 'esm', minify: true, target: 'es2020', write: false,
  external: ['three', 'three/addons/*', './pracownia/*', 'fs'], legalComments: 'none', charset: 'utf8', logLevel: 'warning',
});
fs.rmSync(start);
const kod = PODPIS + '\n' + wyn.outputFiles[0].text;
const nazwa = 'js/' + crypto.createHash('sha1').update(kod).digest('hex').slice(0, 10) + '.js';
fs.writeFileSync(path.join(OUT, nazwa), kod);

// 3. index.html: pierwszy skrypt zostaje w swoim miejscu, reszta znika; mapa importów musi stać przed nim
moduly.forEach(m => { html = html.replace(m[0], ''); });
const mapa = /[ \t]*<script type="importmap">[\s\S]*?<\/script>\s*/.exec(html);
if (!mapa) throw new Error('index.html: brak mapy importów');
html = html.replace(mapa[0], '').replace('</body>', `${mapa[0].trimEnd()}\n  <script type="module" src="${nazwa}"></script>\n</body>`);
html = html.replace(/<!DOCTYPE html>\s*/i, `<!DOCTYPE html>\n<!-- (c) ${rok} OGIMORA - ogimora.com. Wszelkie prawa zastrzezone / All rights reserved. -->\n`);

// 4. CSS: ściśnięty, z podpisem; adres z sumą kontrolną (świeży po każdej zmianie)
for (const m of [...html.matchAll(/href="([\w.-]+\.css)(\?v=[\w.]+)?"/g)]) {
  const css = (await transform(fs.readFileSync(path.join(SRC, m[1]), 'utf8'), { loader: 'css', minify: true })).code;
  fs.writeFileSync(path.join(OUT, m[1]), PODPIS + '\n' + css);
  html = html.replace(m[0], `href="${m[1]}?v=${crypto.createHash('sha1').update(css).digest('hex').slice(0, 6)}"`);
}
// 4b. wersje językowe: / (według przeglądarki), /pl/, /en/ – patrz jezyki.mjs
for (const [j, h] of Object.entries(wersjeJezykowe(html, wersja))) {
  if (j) fs.mkdirSync(path.join(OUT, j), { recursive: true });
  fs.writeFileSync(path.join(OUT, j, 'index.html'), h);
}

// 5. licencje bibliotek obcych (muszą zostać przy kodzie)
const naglowek = (p, n) => fs.readFileSync(path.join(SRC, p), 'utf8').split('\n').slice(0, n).join('\n');
fs.writeFileSync(path.join(OUT, 'js/LICENCJE.txt'), [
  'Strona ogimora.com (c) OGIMORA - wszelkie prawa zastrzezone. Ponizej licencje bibliotek obcych uzytych w kodzie.',
  'three.js (MIT) - ladowane z cdn.jsdelivr.net - https://github.com/mrdoob/three.js/blob/dev/LICENSE',
  '--- Clipper (Angus Johnson, Boost Software License 1.0) ---\n' + (/\/\*{5,}[\s\S]*?\*\//.exec(naglowek('js/zdobienia/vendor/clipper.mjs', 60)) || [''])[0],
  '--- polygon-clipping, splaytree, robust-predicates ---\n' + naglowek('js/vendor/polygon-clipping.js', 1).slice(0, 300),
  '--- opentype.js ---\n' + fs.readFileSync(path.join(SRC, 'js/vendor/opentype_LICENSE.txt'), 'utf8'),
  '--- Hershey Sans ---\n' + naglowek('js/zdobienia/vendor/hershey_sans.js', 12).split('\n').filter(l => /^\s*(\/\/|\/\*|\*)/.test(l)).join('\n'),
].join('\n\n') + '\n');

const kb = f => Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' kB';
console.log(`wydanie/ gotowe - wersja ${wersja} - skrypt ${nazwa} (${kb(nazwa)})`);

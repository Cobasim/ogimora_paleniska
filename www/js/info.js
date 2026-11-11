// OGIMORA – uczciwa informacja: strona testowa, ostrzeżenie przy pliku DXF, jakie dane są zbierane.
// Wszystkie teksty (PL / EN) są w tym pliku – zmieniaj tutaj.
import { LANG } from './i18n.js';
import { WERSJA, DATA_WERSJI, LIMIT_SZTUK } from './wersja.js';
import { statystykiDzialaja, wylaczonePrzezPrzegladarke, wylaczonePrzezUzytkownika, ustawStatystyki, track } from './track.js';
const EN = LANG === 'en';
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- teksty
const T = EN ? {
  test: 'TEST SITE', test2: 'files come with no warranty – read before you cut', testT: 'Test site – read before you cut',
  info: 'About this site', 
  barH: 'Test site', barP: 'The DXF file is made by a script – check it before cutting. I collect anonymous statistics: no cookies, no IP address.', barOk: 'OK', barMore: 'Details',
  h1: 'This is a test site',
  p1: ['OGIMORA is a one-person project in an early stage. The generator is free and still changing.',
       'Designs from this generator have <b>not yet been cut in steel</b> and test-assembled.'],
  h2: 'The DXF file – before you cut',
  ostrz: ['The file is <b>generated automatically by a script</b>. Nobody checks it before you download it.',
          'I <b>do not guarantee</b> that the file is correct or that the parts will fit. It may contain errors.',
          'Check it before cutting: dimensions, sheet thickness, tab clearance for your machine. First print and check the <b>paper model (PDF)</b> or make a trial cut in cheap material.',
          'You decide to cut <b>at your own risk</b>. I am not liable for wasted material, machine time or other costs.',
          'A fire pit means fire: whoever builds and uses it is responsible for doing so safely. The bridges in the patterns reduce falling embers but <b>do not stop sparks</b>.'],
  zgoda: 'I understand – I download and use the file at my own risk',
  hL: 'Licence – what you may do with a downloaded file',
  lic: ['<b>For yourself:</b> do what you like with the design – cut it, change it, give it away.',
        `<b>Commercially:</b> you may sell <b>up to ${LIMIT_SZTUK} finished fire pits per design</b>. That is my thank-you for testing. Want more? Write to info@ogimora.com.`,
        'Do not sell or pass on the files themselves (DXF, PDF).',
        'You may leave the OGIMORA lettering on a fire pit, but do not present yourself as OGIMORA or its representative.',
        'Files downloaded during the test keep these rights for good.'],
  licKrotko: `Licence: free for your own use; commercially up to ${LIMIT_SZTUK} fire pits per design; do not sell the files.`, wer: 'Site version',
  h3: 'What I collect – anonymously',
  zb: ['<b>Per visit, counters only:</b> approximate country (from your browser time zone), browser language, device type (phone / tablet / computer), the site you came from, and how many times each button or slider was used.',
       '<b>Per downloaded file, one line:</b> date, approximate country, dimensions, sheet thickness, chosen patterns, whether there is lettering (only the number of characters), floor holes.',
       '<b>Survey and “Tell me what to change”:</b> only what you type yourself.'],
  h4: 'What I do not collect',
  nz: ['No cookies and no visitor or browser identifier – I cannot tell that two visits came from the same person.',
       'Your IP address is not stored. (For one hour a scrambled fingerprint of it is kept only to block spam floods, then deleted.)',
       '<b>The text of your lettering never leaves your browser.</b>',
       'If you leave an e-mail in “Tell me what to change”, it is stored only with that one message so I can reply. It is <b>not linked</b> to statistics or to your design.'],
  h5: 'Where it goes',
  gd: ['To the ogimora.com server (OVH hosting, EU). Only I read it – to decide what to build next. No advertising, nothing sold or shared.',
       'Your designs (the list under the design name in the top bar), language and choices are saved <b>in this browser only</b> (local storage, not cookies) so they are there when you return. They are not sent anywhere. Clearing the browser data removes them – use “Save to file” to keep a copy.',
       'The page loads fonts from Google Fonts and the 3D library from jsDelivr. Like any site you visit, those servers see your IP address.'],
  wyl: 'Send anonymous statistics from this browser', wylP: 'Off – your browser asks sites not to track (Do Not Track / Global Privacy Control).',
  kontakt: 'Questions, or want something removed? info@ogimora.com',
  zamknij: 'Close', dlWarn: 'Before you cut – read this',
} : {
  test: 'STRONA TESTOWA', test2: 'pliki bez gwarancji – przeczytaj, zanim wytniesz', testT: 'Strona testowa – przeczytaj, zanim wytniesz',
  info: 'O stronie',
  barH: 'Strona testowa', barP: 'Plik DXF tworzy skrypt – sprawdź go przed cięciem. Zbieram anonimowe statystyki: bez ciasteczek, bez adresu IP.', barOk: 'OK', barMore: 'Szczegóły',
  h1: 'To jest strona testowa',
  p1: ['OGIMORA to jednoosobowy projekt na wczesnym etapie. Generator jest darmowy i ciągle się zmienia.',
       'Projekty z tego generatora <b>nie były jeszcze wycinane w stali</b> ani próbnie składane.'],
  h2: 'Plik DXF – zanim wytniesz',
  ostrz: ['Plik jest <b>generowany automatycznie przez skrypt</b>. Nikt go nie sprawdza przed pobraniem.',
          '<b>Nie gwarantuję</b>, że plik jest poprawny ani że części będą do siebie pasować. Może zawierać błędy.',
          'Sprawdź go przed cięciem: wymiary, grubość blachy, luz na ząbkach dla swojej maszyny. Najpierw wydrukuj i sprawdź <b>model papierowy (PDF)</b> albo wytnij próbnie z taniego materiału.',
          'O cięciu decydujesz sam, <b>na własną odpowiedzialność</b>. Nie odpowiadam za zmarnowany materiał, czas maszyny ani inne koszty.',
          'Palenisko to ogień: za bezpieczne wykonanie i używanie odpowiada ten, kto je robi i używa. Mostki we wzorach ograniczają wypadanie żaru, ale <b>nie zatrzymują iskier</b>.'],
  zgoda: 'Rozumiem – pobieram i używam pliku na własną odpowiedzialność',
  hL: 'Licencja – co wolno z pobranym plikiem',
  lic: ['<b>Dla siebie:</b> rób z projektem, co chcesz – wytnij, zmień, podaruj.',
        `<b>Komercyjnie:</b> możesz sprzedać <b>do ${LIMIT_SZTUK} gotowych palenisk z jednego projektu</b>. To moje podziękowanie za testowanie. Chcesz więcej – napisz: info@ogimora.com.`,
        'Nie wolno sprzedawać ani przekazywać dalej samych plików (DXF, PDF).',
        'Napis OGIMORA możesz zostawić na palenisku, ale nie przedstawiaj się jako OGIMORA ani jej przedstawiciel.',
        'Pliki pobrane w czasie testu zachowują te prawa na zawsze.'],
  licKrotko: `Licencja: dla siebie bez ograniczeń; komercyjnie do ${LIMIT_SZTUK} palenisk z jednego projektu; plików nie wolno sprzedawać.`, wer: 'Wersja strony',
  h3: 'Co zbieram – anonimowo',
  zb: ['<b>Z wizyty, same liczniki:</b> przybliżony kraj (ze strefy czasowej przeglądarki), język przeglądarki, rodzaj urządzenia (telefon / tablet / komputer), strona, z której przyszedłeś, oraz ile razy użyto którego przycisku i suwaka.',
       '<b>Z pobranego pliku, jedna linijka:</b> data, przybliżony kraj, wymiary, grubość blachy, wybrane wzory, czy jest napis (tylko liczba znaków), otwory w dnie.',
       '<b>Ankieta i „Napisz, co zmienić”:</b> tylko to, co sam wpiszesz.'],
  h4: 'Czego nie zbieram',
  nz: ['Żadnych ciasteczek ani identyfikatora osoby czy przeglądarki – nie umiem rozpoznać, że dwie wizyty to ta sama osoba.',
       'Adres IP nie jest zapisywany. (Przez godzinę trzymany jest tylko jego zaszyfrowany skrót, żeby zatrzymać zalew spamu – potem znika.)',
       '<b>Treść Twojego napisu nie opuszcza przeglądarki.</b>',
       'Jeśli zostawisz e-mail w „Napisz, co zmienić”, jest zapisany tylko przy tej jednej wiadomości, żebym mógł odpowiedzieć. <b>Nie łączę go</b> ze statystykami ani z Twoim projektem.'],
  h5: 'Gdzie to trafia',
  gd: ['Na serwer ogimora.com (hosting OVH, UE). Czytam to tylko ja – żeby wiedzieć, co budować dalej. Bez reklam, nic nie sprzedaję ani nie przekazuję.',
       'Twoje projekty (lista pod nazwą projektu na górnym pasku), język i wybory zapisują się <b>tylko w tej przeglądarce</b> (pamięć lokalna, nie ciasteczka), żeby były, gdy wrócisz. Nigdzie nie są wysyłane. Wyczyszczenie danych przeglądarki je usuwa – kopię zrobisz przez „Zapisz do pliku”.',
       'Strona pobiera czcionki z Google Fonts i bibliotekę 3D z jsDelivr. Te serwery, jak każda odwiedzana strona, widzą Twój adres IP.'],
  wyl: 'Wysyłaj anonimowe statystyki z tej przeglądarki', wylP: 'Wyłączone – Twoja przeglądarka prosi strony, żeby nie śledziły (Do Not Track / Global Privacy Control).',
  kontakt: 'Pytania albo chcesz coś usunąć? info@ogimora.com',
  zamknij: 'Zamknij', dlWarn: 'Zanim wytniesz – przeczytaj',
};
const lista = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';

// ---------------------------------------------------------------- pasek: znaczek TEST i przycisk „O stronie”
const hdr = document.querySelector('header.ob');
const znak = document.createElement('button'); znak.type = 'button'; znak.className = 'ob-test'; znak.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 22 20.5H2z"/><path d="M12 10v5M12 17.6v.4"/></svg><b class="t-dl">${T.test}</b><b class="t-kr">TEST</b><span>${T.test2}</span>`; znak.title = T.testT;
hdr.querySelector('.ob-brand').after(znak);
// (przycisk „i” usunięty – okno „O stronie” otwiera ramka STRONA TESTOWA)

// ---------------------------------------------------------------- okno „O stronie”
const dlg = document.createElement('dialog'); dlg.className = 'dl info-dlg'; dlg.id = 'infoDlg';
dlg.innerHTML = `<button type="button" class="dl-x" data-close aria-label="${T.zamknij}">✕</button>
  <h2>${T.h1}</h2>${T.p1.map(x => `<p>${x}</p>`).join('')}
  <h3 id="infoDxf">${T.h2}</h3>${lista(T.ostrz)}
  <h3>${T.hL}</h3>${lista(T.lic)}
  <h3 id="infoDane">${T.h3}</h3>${lista(T.zb)}
  <h3>${T.h4}</h3>${lista(T.nz)}
  <h3>${T.h5}</h3>${lista(T.gd)}
  <label class="p-same info-wyl"><input type="checkbox" id="infoStat"><span>${T.wyl}</span></label><p class="info-male" id="infoStatP"></p>
  <p class="info-male">${T.kontakt}<br>${T.wer}: ${WERSJA} · ${DATA_WERSJI}</p>`;
document.body.appendChild(dlg);
dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
function otworz(kotwica) {
  const c = $('infoStat'); c.checked = statystykiDzialaja(); c.disabled = wylaczonePrzezPrzegladarke();
  $('infoStatP').textContent = wylaczonePrzezPrzegladarke() ? T.wylP : '';
  dlg.showModal(); dlg.scrollTop = 0;
  if (kotwica && $(kotwica)) $(kotwica).scrollIntoView({ block: 'start' });
  track('info');
}
$('infoStat').addEventListener('change', e => ustawStatystyki(e.target.checked));
znak.addEventListener('click', () => otworz());

// ---------------------------------------------------------------- pierwsza wizyta: mała kartka (nie zasłania pracy, znika po „OK”)
let widzial = false; try { widzial = localStorage.getItem('ogip_info_ok') === '1'; } catch {}
if (!widzial) {
  const b = document.createElement('div'); b.className = 'info-bar'; b.setAttribute('role', 'status');
  b.innerHTML = `<b>${T.barH}</b><span>${T.barP}</span><div><button type="button" class="chip" data-m>${T.barMore}</button><button type="button" class="chip active" data-ok>${T.barOk}</button></div>`;
  document.body.appendChild(b);
  b.addEventListener('click', e => {
    if (e.target.closest('[data-m]')) otworz();
    if (e.target.closest('[data-ok]') || e.target.closest('[data-m]')) { try { localStorage.setItem('ogip_info_ok', '1'); } catch {} b.remove(); }
  });
}

// ---------------------------------------------------------------- okno pobierania: ostrzeżenie zawsze na górze + potwierdzenie
const box = $('dlOstrz');
if (box) {
  box.innerHTML = `<b>${T.dlWarn}</b>${lista(T.ostrz)}<label class="p-same dl-zgoda"><input type="checkbox" id="dlZgoda"><span>${T.zgoda}</span></label><p class="dl-lic">${T.licKrotko}</p>`;
  // zgoda obowiązuje do końca dnia (data w pamięci przeglądarki); następnego dnia trzeba ją zaznaczyć ponownie
  const dzis = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const wazna = () => { try { return localStorage.getItem('ogip_zgoda_dxf') === dzis(); } catch { return false; } };
  $('dlZgoda').checked = wazna();
  $('dlZgoda').addEventListener('change', e => { try { if (e.target.checked) localStorage.setItem('ogip_zgoda_dxf', dzis()); else localStorage.removeItem('ogip_zgoda_dxf'); } catch {} });
  // strona otwarta od wczoraj: przy otwieraniu okna pobierania sprawdzamy datę jeszcze raz (przed obsługą kliknięcia w app.js)
  const dlBtn = $('download'); if (dlBtn) dlBtn.addEventListener('click', () => { if ($('dlZgoda').checked && !wazna()) $('dlZgoda').checked = false; }, true);
}

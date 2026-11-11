// Okno „Napisz, co zmienić” → api/zbierz.php?typ=komentarz.
// Wysyłane jest tylko to, co wpisano (tekst, ewentualnie e-mail) – bez żadnego identyfikatora i bez projektu,
// żeby wiadomości (i podanego e-maila) nie dało się połączyć ze statystykami.
const d = document.getElementById('opDlg'), f = document.getElementById('opForm');
const EN = document.documentElement.lang === 'en' || /[?&]lang=en/.test(location.search);
let odKiedy = 0;
document.getElementById('opBtn').addEventListener('click', () => { odKiedy = Date.now(); d.showModal(); f.tekst.focus(); });
d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
f.addEventListener('submit', async e => {
  e.preventDefault();
  const tx = f.tekst.value.trim(); if (!tx) { f.tekst.focus(); return; }
  const em = f.email.value.trim(), o0 = document.getElementById('opOk');
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { f.email.focus(); o0.textContent = EN ? 'Check the e-mail address (or leave it empty)' : 'Sprawdź adres e-mail (albo zostaw puste)'; return; }
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
  const body = JSON.stringify({ tekst: tx.slice(0, 4000), email: f.email.value.trim(), www: f.www.value, ms: Date.now() - odKiedy, tz, lang: (navigator.language || '').slice(0, 2) });
  const ok = await fetch('api/zbierz.php?typ=komentarz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).then(r => r.ok).catch(() => false);
  const o = document.getElementById('opOk');
  if (ok) { f.reset(); o.textContent = 'Dziękuję!'; setTimeout(() => { d.close(); o.textContent = 'trafia prosto do mnie'; }, 1400); }
  else o.textContent = 'Nie udało się wysłać – napisz na info@ogimora.com';
});

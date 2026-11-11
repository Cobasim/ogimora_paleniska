<?php
date_default_timezone_set('Europe/Warsaw');
// OGIMORA – zbieranie odzewu i ANONIMOWYCH statystyk (wersja uproszczona, 2026-11). Hosting OVH, PHP 7.4+.
//
// Zasady (to samo jest napisane na stronie, w oknie „O stronie”):
//  • żadnych ciasteczek, żadnego identyfikatora osoby ani przeglądarki, adres IP NIE jest zapisywany;
//  • kraj jest przybliżony – ze strefy czasowej przeglądarki;
//  • treść napisu z paleniska nie jest wysyłana (tylko liczba znaków);
//  • e-mail z okna „Napisz, co zmienić” trafia tylko do tej jednej wiadomości – nie łączy się ze statystykami.
//
// Mało miejsca, nawet przy dużym ruchu:
//  • wizyty i przyciski → tylko LICZNIKI w jednym małym pliku na miesiąc (dane/licznik-RRRR-MM.json, kilka–kilkadziesiąt kB);
//  • pobrania → jedna krótka linia na pobranie (dane/pobrania-RRRR-MM.csv), najwyżej MAX_CSV na miesiąc – potem same liczniki;
//  • ankiety i komentarze → tekst w dane/*.jsonl (najwyżej MAX_TXT każdy) + e-mail.
// Podgląd: api/statystyki.php?k=<klucz z dane/klucz.txt>.
//
// Typy: wizyta, pobranie, ankieta, komentarz.

const MAIL_DO  = 'info@ogimora.com';
const MAIL_OD  = 'strona@ogimora.com';            // adres w domenie (OVH wymaga nadawcy z domeny)
const TYPY     = ['wizyta' => 120, 'pobranie' => 60, 'ankieta' => 20, 'komentarz' => 10];   // limit na godzinę z jednego adresu
const DO_MAILA = ['ankieta', 'komentarz'];
const MIN_MS   = 2500;                             // szybciej = automat (formularz z tekstem)
const MAX_CSV  = 3000000;                          // bajtów rejestru pobrań na miesiąc (ok. 25 tys. pobrań)
const MAX_TXT  = 2000000;                          // bajtów na plik ankiet / komentarzy
const MAX_KLUCZY = 300;                            // różnych nazw w jednym liczniku (ochrona przed śmieciami)

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function koniec($ok, $kod = 200) { http_response_code($kod); echo json_encode(['ok' => $ok]); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') koniec(false, 405);
$typ = $_GET['typ'] ?? '';
if (!isset(TYPY[$typ])) koniec(false, 400);
$d = json_decode(file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($d)) koniec(false, 400);

// pułapka na automaty (pole niewidoczne dla ludzi) – automat dostaje „ok”
if (!empty($d['www'])) koniec(true);
$tekst = trim((string)($d['tekst'] ?? $d['notes'] ?? ''));
if (in_array($typ, DO_MAILA, true) && $tekst !== '' && (int)($d['ms'] ?? 99999) < MIN_MS) koniec(true);
if (preg_match_all('#https?://#i', $tekst) > 2) koniec(true);

$dir = __DIR__ . '/dane';
if (!is_dir($dir)) { mkdir($dir, 0750, true); }
if (!is_file("$dir/.htaccess")) file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
if (!is_file("$dir/sol.txt")) file_put_contents("$dir/sol.txt", bin2hex(random_bytes(16)));
if (!is_file("$dir/klucz.txt")) file_put_contents("$dir/klucz.txt", bin2hex(random_bytes(10)));

// limit na godzinę: skrót adresu IP z losową solą, trzymany najwyżej godzinę i tylko tutaj (nie trafia do danych)
$ip = substr(hash('sha256', trim((string)@file_get_contents("$dir/sol.txt")) . date('YmdH') . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 16);
$fh = fopen("$dir/limity.json", 'c+');
if ($fh && flock($fh, LOCK_EX)) {
  $lim = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
  $h = date('YmdH'); $k = "$h|$typ|$ip";
  foreach ($lim as $kk => $v) if (strpos($kk, $h . '|') !== 0) unset($lim[$kk]);
  $lim[$k] = ($lim[$k] ?? 0) + 1; $ile = $lim[$k];
  ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($lim));
  flock($fh, LOCK_UN); fclose($fh);
  if ($ile > TYPY[$typ]) koniec(false, 429);
}

// ---- wartości: tylko krótkie, przewidywalne
function slowo($v, $max = 40, $wz = '/[^A-Za-z0-9_:.\-]/') { return substr(preg_replace($wz, '', (string)$v), 0, $max); }
function kraj($tz) {
  try { $l = (new DateTimeZone((string)$tz))->getLocation(); $c = $l['country_code'] ?? ''; return preg_match('/^[A-Z]{2}$/', $c) ? $c : '??'; }
  catch (Throwable $e) { return '??'; }
}
function plus(&$t, $grupa, $klucz, $n = 1) {
  if ($klucz === '' || $klucz === null) return;
  if (!isset($t[$grupa])) $t[$grupa] = [];
  if (!isset($t[$grupa][$klucz]) && count($t[$grupa]) >= MAX_KLUCZY) $klucz = 'inne';
  $t[$grupa][$klucz] = ($t[$grupa][$klucz] ?? 0) + $n;
}
/** Liczniki: odczyt → zmiana → zapis, pod blokadą. Te same dane trafiają do pliku miesiąca i pliku tygodnia (pon.–niedz., numer tygodnia ISO). */
function licznik($dir, callable $fn) {
  foreach (['licznik-' . date('Y-m'), 'licznik-tydz-' . date('o-\\WW')] as $nazwa) {
    $fh = fopen("$dir/$nazwa.json", 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) continue;
    $t = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $fn($t);
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($t, JSON_UNESCAPED_UNICODE));
    flock($fh, LOCK_UN); fclose($fh);
  }
}
$kraj = kraj($d['tz'] ?? '');
$jez  = strtolower(slowo($d['lang'] ?? '', 2, '/[^A-Za-z]/'));
$urz  = in_array($d['dev'] ?? '', ['mobile', 'tablet', 'desktop'], true) ? $d['dev'] : '';
$dzien = date('d');
$wer   = slowo($d['v'] ?? '', 12, '/[^0-9.]/') ?: 'brak';   // wersja strony (js/wersja.js)

if ($typ === 'wizyta') {
  licznik($dir, function (&$t) use ($d, $kraj, $jez, $urz, $dzien, $wer) {
    if (!empty($d['nowa'])) {
      plus($t, 'razem', 'wizyty'); plus($t, 'dni_wizyty', $dzien); plus($t, 'wizyty_wersja', $wer);
      plus($t, 'kraj', $kraj); plus($t, 'jezyk', $jez); plus($t, 'urzadzenie', $urz);
      plus($t, 'skad', strtolower(slowo($d['ref'] ?? '', 40, '/[^A-Za-z0-9.\-]/')) ?: 'bezposrednio');
      if (!empty($d['src'])) plus($t, 'kampania', slowo($d['src'], 30));
    }
    $i = 0;
    foreach ((array)($d['k'] ?? []) as $k => $n) {
      if (++$i > 80) break;
      $k = slowo($k, 40); $n = max(1, min(200, (int)$n));
      plus($t, 'klikniecia', $k, $n);            // ile razy użyto
      plus($t, 'wizyty_z', $k);                  // w ilu wizytach użyto (w przybliżeniu – liczone przy każdym wysłaniu)
    }
  });
  koniec(true);
}

if ($typ === 'pobranie') {
  $kod = slowo($d['kod'] ?? '', 24, '/[^A-Za-z0-9\-]/');
  $wz = []; foreach (array_slice((array)($d['wz'] ?? []), 0, 4) as $w) $wz[] = slowo($w, 48, '/[^a-z0-9\-]/') ?: '-';
  $nap = []; foreach (array_slice((array)($d['nap'] ?? []), 0, 4) as $n) $nap[] = max(0, min(40, (int)$n));
  $w = (array)($d['wym'] ?? []);
  $wym = ['bok' => (int)($w['bok'] ?? 0), 'wys' => (int)($w['wys'] ?? 0), 'kat' => (int)($w['kat'] ?? 0), 'dno' => (int)($w['dno'] ?? 0), 'nogi' => (int)($w['nogi'] ?? 0), 'blacha' => (int)($w['blacha'] ?? 0)];
  $mat = slowo($d['mat'] ?? '', 12); $ciecie = slowo($d['luz'] ?? '', 6, '/[^0-9.]/');
  $otw = max(0, min(8, (int)($d['otw'] ?? 0)));
  $poza = false;
  $csv = "$dir/pobrania-" . date('Y-m') . '.csv';
  if (!is_file($csv)) file_put_contents($csv, "czas;kraj;jezyk;urzadzenie;kod;bok;wysokosc;kat;dno;nozki;blacha;material;luz;wzory;napis_znakow;otwory_dna;wersja\n", LOCK_EX);
  if (filesize($csv) < MAX_CSV) {
    $linia = [date('Y-m-d H:i'), $kraj, $jez, $urz, $kod, $wym['bok'], $wym['wys'], $wym['kat'], $wym['dno'], $wym['nogi'], $wym['blacha'], $mat, $ciecie,
              implode('|', $wz), implode('|', $nap), $otw, $wer];
    file_put_contents($csv, implode(';', $linia) . "\n", FILE_APPEND | LOCK_EX);
  } else $poza = true;
  licznik($dir, function (&$t) use ($wz, $nap, $wym, $mat, $kraj, $dzien, $d, $otw, $poza, $wer) {
    plus($t, 'razem', 'pobrania'); plus($t, 'pobrania_wersja', $wer); plus($t, 'dni_pobrania', $dzien); plus($t, 'pobrania_kraj', $kraj);
    if ($poza) plus($t, 'razem', 'pobrania_poza_rejestrem');
    foreach (array_unique($wz) as $w) plus($t, 'wzor', $w === '-' ? 'bez_wzoru' : $w);
    plus($t, 'napis', array_sum($nap) > 0 ? 'jest' : 'brak');
    plus($t, 'otwory_dna', (string)$otw);
    plus($t, 'blacha_mm', (string)$wym['blacha']); plus($t, 'material', $mat);
    plus($t, 'bok_dna_mm', (string)(intdiv($wym['bok'], 50) * 50));          // przedziały co 50 mm
    plus($t, 'wysokosc_mm', (string)(intdiv($wym['wys'], 50) * 50));
    plus($t, 'kat_stopni', (string)((int)floor($wym['kat'] / 5) * 5));
    plus($t, 'dno_nad_ziemia_mm', (string)(intdiv($wym['dno'], 25) * 25));
  });
  koniec(true);
}

// ---- ankieta i komentarz: tekst od człowieka (plik + e-mail)
unset($d['www'], $d['sid'], $d['kod'], $d['code']);
// komentarz (może zawierać e-mail) – bez kraju i języka, żeby nie dało się go zestawić ze statystykami
$rek = $typ === 'ankieta' ? ['typ' => $typ, 'czas' => date('Y-m-d H:i'), 'kraj' => $kraj, 'jezyk' => $jez] : ['typ' => $typ, 'czas' => date('Y-m-d H:i')];
if ($typ === 'ankieta') {
  foreach (['use', 'license', 'pay'] as $p) if (!empty($d[$p])) $rek[$p] = slowo($d[$p], 20);
  if ($tekst !== '') $rek['uwagi'] = mb_substr($tekst, 0, 2000);
  if (count($rek) <= 4) koniec(true);                       // pusta ankieta – nic do zapisania
  licznik($dir, function (&$t) use ($rek) { plus($t, 'razem', 'ankiety'); foreach (['use', 'license', 'pay'] as $p) if (isset($rek[$p])) plus($t, "ankieta_$p", $rek[$p]); });
} else {
  if ($tekst === '') koniec(false, 400);
  $rek['tekst'] = mb_substr($tekst, 0, 4000);
  $email = filter_var($d['email'] ?? '', FILTER_VALIDATE_EMAIL);
  if ($email) $rek['email'] = $email;
  licznik($dir, function (&$t) { plus($t, 'razem', 'komentarze'); });
}
$plik = "$dir/$typ.jsonl";
if (!is_file($plik) || filesize($plik) < MAX_TXT) file_put_contents($plik, json_encode($rek, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
$temat = '=?UTF-8?B?' . base64_encode("OGIMORA · $typ") . '?=';
$nag = "From: OGIMORA <" . MAIL_OD . ">\r\nContent-Type: text/plain; charset=UTF-8";
if (!empty($rek['email'])) $nag .= "\r\nReply-To: " . $rek['email'];
@mail(MAIL_DO, $temat, json_encode($rek, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), $nag);
koniec(true);

<?php
date_default_timezone_set('Europe/Warsaw');
// OGIMORA – podgląd statystyk. Adres: api/statystyki.php?k=<klucz>  (klucz: plik api/dane/klucz.txt, pobierz FTP-em).
// &m=RRRR-MM – inny miesiąc · &csv=1 – rejestr pobrań miesiąca jako plik CSV (otwiera się w Excelu / Numbers).
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$dir = __DIR__ . '/dane';
$klucz = trim((string)@file_get_contents("$dir/klucz.txt"));
if ($klucz === '' || !hash_equals($klucz, (string)($_GET['k'] ?? ''))) { http_response_code(404); exit('Not found'); }
$m = preg_match('/^\d{4}-\d{2}$/', $_GET['m'] ?? '') ? $_GET['m'] : date('Y-m');
if (!empty($_GET['csv'])) {
  $f = "$dir/pobrania-$m.csv"; if (!is_file($f)) { http_response_code(404); exit('Brak rejestru za ten miesiąc'); }
  header('Content-Type: text/csv; charset=utf-8'); header("Content-Disposition: attachment; filename=\"ogimora-pobrania-$m.csv\""); readfile($f); exit;
}
header('Content-Type: text/html; charset=utf-8');
$mies = []; foreach (glob("$dir/licznik-*.json") as $f) $mies[] = substr(basename($f), 8, 7); rsort($mies);
$t = json_decode((string)@file_get_contents("$dir/licznik-$m.json"), true) ?: [];
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$NAZWY = ['razem' => 'Razem w miesiącu', 'dni_wizyty' => 'Wizyty – dni miesiąca', 'dni_pobrania' => 'Pobrania – dni miesiąca', 'kraj' => 'Wizyty – kraj (ze strefy czasowej)',
  'pobrania_kraj' => 'Pobrania – kraj', 'jezyk' => 'Język przeglądarki', 'urzadzenie' => 'Urządzenie', 'skad' => 'Skąd przyszli', 'kampania' => 'Kampania (?src=)',
  'wzor' => 'Pobrane wzory', 'napis' => 'Napis w pobranych', 'otwory_dna' => 'Otwory w dnie', 'blacha_mm' => 'Grubość blachy [mm]', 'material' => 'Materiał',
  'bok_dna_mm' => 'Bok dna [mm, od]', 'wysokosc_mm' => 'Wysokość paleniska [mm, od]', 'kat_stopni' => 'Odchylenie ścianek [°, od]', 'dno_nad_ziemia_mm' => 'Dno nad ziemią [mm, od]',
  'klikniecia' => 'Przyciski i suwaki – ile razy', 'wizyty_z' => 'Przyciski i suwaki – w ilu wizytach', 'ankieta_use' => 'Ankieta: do czego', 'ankieta_license' => 'Ankieta: licencja', 'ankieta_pay' => 'Ankieta: za co by zapłacił'];
$PO_KLUCZU = ['dni_wizyty', 'dni_pobrania', 'bok_dna_mm', 'wysokosc_mm', 'kat_stopni', 'dno_nad_ziemia_mm', 'blacha_mm', 'otwory_dna'];
$rozmiar = 0; foreach (glob("$dir/*") as $f) $rozmiar += filesize($f);
?><!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>OGIMORA – statystyki <?= $e($m) ?></title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#16130f;background:#f6f4f0}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:0 0 6px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;margin-top:16px}.k{background:#fff;border:1px solid #e5e0d8;border-radius:10px;padding:12px 14px}
table{width:100%;border-collapse:collapse}td{padding:2px 0;border-top:1px solid #f0ece5}td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.p{position:relative}.p i{position:absolute;left:0;top:3px;bottom:3px;background:#b4532a22;border-radius:3px}.p span{position:relative;word-break:break-all}a{color:#b4532a}small{color:#7a726a}</style>
<h1>OGIMORA – statystyki <?= $e($m) ?></h1>
<small>Miesiące: <?php foreach ($mies as $x) echo '<a href="?k=' . $e($klucz) . '&m=' . $e($x) . '">' . $e($x) . '</a> · '; ?>
<a href="?k=<?= $e($klucz) ?>&m=<?= $e($m) ?>&csv=1">rejestr pobrań (CSV)</a> · wszystkie dane zajmują <?= number_format($rozmiar / 1024, 0, ',', ' ') ?> kB</small>
<?php if (!$t) echo '<p>Brak danych za ten miesiąc.</p>'; ?>
<div class="g"><?php
$kol = array_merge(array_keys($NAZWY), array_diff(array_keys($t), array_keys($NAZWY)));
foreach ($kol as $g) { if (empty($t[$g])) continue; $w = $t[$g];
  if (in_array($g, $PO_KLUCZU, true)) ksort($w, SORT_NUMERIC); elseif ($g !== 'razem') arsort($w);
  $max = max($w) ?: 1; $suma = array_sum($w);
  echo '<div class="k"><h2>' . $e($NAZWY[$g] ?? $g) . '</h2><table>';
  $i = 0; foreach ($w as $k => $n) { if (++$i > 60) { echo '<tr><td><small>… i ' . (count($w) - 60) . ' innych</small></td><td></td></tr>'; break; }
    echo '<tr><td class="p"><i style="width:' . round($n / $max * 100) . '%"></i><span>' . $e($k) . '</span></td><td>' . (int)$n . ($g === 'razem' ? '' : ' <small>' . round($n / $suma * 100) . '%</small>') . '</td></tr>'; }
  echo '</table></div>'; }
?></div></html>

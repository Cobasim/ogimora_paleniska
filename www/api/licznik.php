<?php
// OGIMORA – sumy do stopki strony: wizyty (w), pobrania DXF (d), modele PDF (p). Nic więcej stąd nie wychodzi.
// Palenisko: w, d, p – liczone od wersji 0.1.4 (do 0.4.2 wspólne dla całej strony). Kostka: kw, kd, kp – liczone od zera od wersji 0.4.3.
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$t = json_decode((string)@file_get_contents(__DIR__ . '/dane/razem.json'), true) ?: [];
$o = []; foreach (['w', 'd', 'p', 'kw', 'kd', 'kp'] as $k) $o[$k] = (int)($t[$k] ?? 0);
echo json_encode($o);

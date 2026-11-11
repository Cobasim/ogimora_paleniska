<?php
// OGIMORA – trzy sumy do stopki strony: wizyty (w), pobrania DXF (d), modele PDF (p). Liczone od wersji 0.1.4. Nic więcej stąd nie wychodzi.
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$t = json_decode((string)@file_get_contents(__DIR__ . '/dane/razem.json'), true) ?: [];
echo json_encode(['w' => (int)($t['w'] ?? 0), 'd' => (int)($t['d'] ?? 0), 'p' => (int)($t['p'] ?? 0)]);

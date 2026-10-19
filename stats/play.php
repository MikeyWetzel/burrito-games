<?php
require __DIR__ . '/lib.php';
header('Cache-Control: no-store');
$g = $_GET['g'] ?? '';
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !in_array($g, BG_GAMES, true)) { http_response_code(400); exit; }
$today = (new DateTime('now', bg_tz()))->format('Y-m-d');
$h = @fopen(bg_data_file(), 'c+');
if ($h && flock($h, LOCK_EX)) {
  $d = json_decode(stream_get_contents($h) ?: '{}', true); if (!is_array($d)) $d = [];
  $d['total'][$g] = ($d['total'][$g] ?? 0) + 1;
  $d['day'][$today][$g] = ($d['day'][$today][$g] ?? 0) + 1;
  if (count($d['day']) > 400) { ksort($d['day']); $d['day'] = array_slice($d['day'], -400, null, true); }
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($d)); fflush($h); flock($h, LOCK_UN);
}
if ($h) fclose($h);
http_response_code(204);

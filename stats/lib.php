<?php
// Anonymous play counters. No IPs, cookies or identifiers are read or stored.
const BG_GAMES = ['angry-burritos', 'burrito-ninja', 'burrito-sweeper', 'flappy-burrito', 'fsd'];
function bg_data_file() {
  $dir = dirname(__DIR__, 3) . '/private/burrito-stats'; // outside public_html
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  return $dir . '/counts.json';
}
function bg_tz() { return new DateTimeZone('America/New_York'); }
function bg_read() {
  $f = bg_data_file();
  $h = @fopen($f, 'r'); if (!$h) return [];
  flock($h, LOCK_SH); $s = stream_get_contents($h); flock($h, LOCK_UN); fclose($h);
  $d = json_decode($s ?: '{}', true); return is_array($d) ? $d : [];
}
function bg_summary() {
  $d = bg_read(); $today = (new DateTime('now', bg_tz()))->format('Y-m-d'); $out = [];
  foreach (BG_GAMES as $g) $out[$g] = ['total' => (int)($d['total'][$g] ?? 0), 'today' => (int)($d['day'][$today][$g] ?? 0)];
  return ['date' => $today, 'games' => $out];
}

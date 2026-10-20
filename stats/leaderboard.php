<?php
// FSD Mad Max global leaderboard. Top 100, stored outside public_html.
// Privacy: no IPs are stored. Rate limiting uses an HMAC of the address with a random
// salt that rotates every hour and is thrown away, so entries cannot be linked back.
ini_set('serialize_precision', '-1');
header('Content-Type: application/json'); header('Cache-Control: no-store');
const LB_MAX = 100, LB_CAP = 2000000;
$dir = dirname(__DIR__, 3) . '/private/burrito-stats'; if (!is_dir($dir)) @mkdir($dir, 0700, true);
$file = "$dir/fsd-leaderboard.json"; $rlf = "$dir/fsd-ratelimit.json";
function lb_out($code, $a) { http_response_code($code); echo json_encode($a); exit; }
function lb_read($file) { $h = @fopen($file, 'r'); if (!$h) return []; flock($h, LOCK_SH); $d = json_decode(stream_get_contents($h) ?: '[]', true); flock($h, LOCK_UN); fclose($h); return is_array($d) ? $d : []; }
function lb_pub($rows) { return array_map(fn($r) => ['n' => $r['n'], 's' => $r['s'], 'd' => $r['d'], 'at' => $r['at']], $rows); }
$m = $_SERVER['REQUEST_METHOD'];
if ($m === 'GET') lb_out(200, ['top' => lb_pub(lb_read($file))]);
if ($m !== 'POST') lb_out(405, ['error' => 'method']);
$raw = file_get_contents('php://input', false, null, 0, 600); $in = json_decode($raw ?: '', true);
if (!is_array($in)) lb_out(400, ['error' => 'json']);
$n = strtoupper(trim((string)($in['n'] ?? ''))); $s = $in['s'] ?? null; $t = $in['t'] ?? null; $dm = $in['d'] ?? null;
if (!preg_match('/^[A-Z0-9][A-Z0-9 ]{0,7}$/', $n)) lb_out(400, ['error' => 'name']);
foreach ([$s, $t, $dm] as $v) if (!is_int($v) && !is_float($v)) lb_out(400, ['error' => 'fields']);
$s = (int)$s; $t = (float)$t; $dm = (float)$dm;
// sanity: duration, distance at <=150 mph, score rate
if ($s < 1 || $s > LB_CAP || $t < 3 || $t > 7200 || $dm < 0 || $dm > $t * 68 + 500 || $s > $t * 400 + 3000) lb_out(422, ['error' => 'implausible']);
// rate limit: 5 per 10 min per (hashed, hourly-salted) client, 200 per hour overall
$now = time(); $hour = intdiv($now, 3600);
$h = fopen($rlf, 'c+'); flock($h, LOCK_EX); $rl = json_decode(stream_get_contents($h) ?: '{}', true) ?: [];
if (($rl['hour'] ?? -1) !== $hour) $rl = ['hour' => $hour, 'salt' => bin2hex(random_bytes(16)), 'n' => 0, 'c' => []];
$k = substr(hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '', $rl['salt']), 0, 16);
$hits = array_values(array_filter($rl['c'][$k] ?? [], fn($x) => $x > $now - 600));
if (count($hits) >= 5 || $rl['n'] >= 200) { flock($h, LOCK_UN); fclose($h); lb_out(429, ['error' => 'slow down']); }
$hits[] = $now; $rl['c'][$k] = $hits; $rl['n']++;
ftruncate($h, 0); rewind($h); fwrite($h, json_encode($rl)); fflush($h); flock($h, LOCK_UN); fclose($h);
// insert
$h = fopen($file, 'c+'); flock($h, LOCK_EX); $rows = json_decode(stream_get_contents($h) ?: '[]', true) ?: [];
$rows[] = ['n' => $n, 's' => $s, 'd' => round($dm / 1609.34, 1), 'at' => gmdate('Y-m-d')];
usort($rows, fn($a, $b) => $b['s'] <=> $a['s']); $rows = array_slice($rows, 0, LB_MAX);
$rank = 0; foreach ($rows as $i => $r) if ($r['n'] === $n && $r['s'] === $s) { $rank = $i + 1; break; }
ftruncate($h, 0); rewind($h); fwrite($h, json_encode($rows)); fflush($h); flock($h, LOCK_UN); fclose($h);
lb_out(200, ['ok' => true, 'rank' => $rank, 'top' => lb_pub($rows)]);

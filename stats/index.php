<?php
require __DIR__ . '/lib.php';
header('Cache-Control: public, max-age=60');
$s = bg_summary();
$names = ['angry-burritos'=>'Angry Burritos','burrito-ninja'=>'Burrito Ninja','burrito-sweeper'=>'Burrito Sweeper','flappy-burrito'=>'Flappy Burrito','fsd'=>'FSD Mad Max'];
$T = 0; $D = 0;
?><!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Burrito Games — Play Stats</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#222}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #eee;text-align:right}td:first-child,th:first-child{text-align:left}small{color:#888}</style></head><body>
<h1>🌯 Play stats</h1><p><small>Anonymous play counts (no IPs, cookies or identifiers). Today = <?= htmlspecialchars($s['date']) ?> (New York).</small></p>
<table><tr><th>Game</th><th>Total</th><th>Today</th></tr>
<?php foreach ($s['games'] as $g => $c): $T += $c['total']; $D += $c['today']; ?>
<tr><td><a href="../<?= $g ?>/"><?= $names[$g] ?></a></td><td><?= number_format($c['total']) ?></td><td><?= number_format($c['today']) ?></td></tr>
<?php endforeach; ?>
<tr><th>All</th><th><?= number_format($T) ?></th><th><?= number_format($D) ?></th></tr></table>
<p><a href="../">← Burrito Games</a></p></body></html>

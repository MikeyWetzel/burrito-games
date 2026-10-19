<?php
require __DIR__ . '/lib.php';
header('Content-Type: application/json');
header('Cache-Control: public, max-age=60');
echo json_encode(bg_summary());

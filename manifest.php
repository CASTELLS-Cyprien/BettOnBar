<?php
header('Content-Type: application/manifest+json');
header('Cache-Control: public, max-age=86400');
readfile(__DIR__ . '/manifest.json');

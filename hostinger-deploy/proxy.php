<?php
/**
 * Reverse proxy — serves the Vercel app at divulga.top (no DNS change needed).
 * Upload to public_html and point .htaccess here.
 */
define('BACKEND', 'https://divulga-top.vercel.app');

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$url = BACKEND . $uri;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$forwardHeaders = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        if (in_array($lower, ['host', 'connection', 'content-length'], true)) {
            continue;
        }
        $forwardHeaders[] = "$name: $value";
    }
}
$forwardHeaders[] = 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? 'divulga.top');
$forwardHeaders[] = 'X-Forwarded-Proto: https';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

if (!in_array($method, ['GET', 'HEAD'], true)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input') ?: '');
}

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    echo 'Servico temporariamente indisponivel.';
    exit;
}

$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

http_response_code($code);

$skip = ['transfer-encoding', 'content-encoding', 'connection', 'keep-alive', 'content-length'];
foreach (explode("\r\n", $rawHeaders) as $line) {
    if ($line === '' || stripos($line, 'HTTP/') === 0) {
        continue;
    }
    $parts = explode(':', $line, 2);
    if (count($parts) < 2) {
        continue;
    }
    $hName = strtolower(trim($parts[0]));
    if (in_array($hName, $skip, true)) {
        continue;
    }
    if ($hName === 'set-cookie') {
        header($line, false);
    } else {
        header($line);
    }
}

echo $body;

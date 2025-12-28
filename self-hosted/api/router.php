<?php
/**
 * API Router
 * Routes all API requests to appropriate endpoints
 */

require_once __DIR__ . '/core/response.php';

Response::setCorsHeaders();

// Get request path
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';

// Remove base path and query string
$path = parse_url($requestUri, PHP_URL_PATH);
$path = preg_replace('#^' . preg_quote($basePath) . '#', '', $path);
$path = trim($path, '/');

// Define routes
$routes = [
    // Auth routes
    'auth/register' => 'auth/register.php',
    'auth/login' => 'auth/login.php',
    'auth/logout' => 'auth/logout.php',
    'auth/verify-email' => 'auth/verify-email.php',
    'auth/2fa' => 'auth/2fa.php',
    'auth/reset-password' => 'auth/reset-password.php',
    'auth/me' => 'auth/me.php',
    
    // Email routes
    'emails/create' => 'emails/create.php',
    'emails/validate' => 'emails/validate.php',
    'emails/inbox' => 'emails/inbox.php',
    'emails/actions' => 'emails/actions.php',
    'emails/domains' => 'emails/domains.php',
    'emails/webhook' => 'emails/webhook.php',
    
    // Admin routes
    'admin/settings' => 'admin/settings.php',
    'admin/domains' => 'admin/domains.php',
    'admin/users' => 'admin/users.php',
    'admin/stats' => 'admin/stats.php',
    
    // Stripe routes
    'stripe/checkout' => 'stripe/checkout.php',
    'stripe/webhook' => 'stripe/webhook.php',
    
    // Storage routes
    'storage/upload' => 'storage/upload.php',
    'storage/download' => 'storage/download.php',
];

// Find matching route
$routeFile = null;
foreach ($routes as $route => $file) {
    if ($path === $route || strpos($path, $route) === 0) {
        $routeFile = __DIR__ . '/' . $file;
        break;
    }
}

// Also check for direct .php file access
if (!$routeFile && preg_match('#^([a-z]+)/([a-z-]+)\.php$#', $path, $matches)) {
    $potentialFile = __DIR__ . '/' . $matches[1] . '/' . $matches[2] . '.php';
    if (file_exists($potentialFile)) {
        $routeFile = $potentialFile;
    }
}

if ($routeFile && file_exists($routeFile)) {
    require $routeFile;
} else {
    Response::notFound('API endpoint not found: ' . $path);
}

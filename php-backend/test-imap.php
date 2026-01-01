<?php
/**
 * IMAP Connection Test Script
 * Used by the installer to test IMAP settings before saving
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Check if IMAP extension is available
if (!function_exists('imap_open')) {
    echo json_encode([
        'success' => false, 
        'error' => 'IMAP extension is not installed. Please enable it in PHP.'
    ]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$host = trim($input['host'] ?? '');
$port = intval($input['port'] ?? 993);
$user = trim($input['user'] ?? '');
$pass = $input['pass'] ?? '';
$folder = $input['folder'] ?? 'INBOX';

if (empty($host) || empty($user) || empty($pass)) {
    echo json_encode(['success' => false, 'error' => 'Host, username, and password are required']);
    exit;
}

try {
    // Build IMAP connection string
    $flags = '/imap';
    
    if ($port == 993) {
        $flags .= '/ssl';
    } elseif ($port == 143) {
        $flags .= '/notls';
    }
    
    // Add novalidate-cert for self-signed certificates (common on shared hosting)
    $flags .= '/novalidate-cert';
    
    $connectionString = '{' . $host . ':' . $port . $flags . '}' . $folder;
    
    // Suppress warnings and capture them
    set_error_handler(function($errno, $errstr) {
        throw new Exception($errstr);
    });
    
    $imap = @imap_open($connectionString, $user, $pass, 0, 1, [
        'DISABLE_AUTHENTICATOR' => 'GSSAPI'
    ]);
    
    restore_error_handler();
    
    if (!$imap) {
        $errors = imap_errors();
        $lastError = imap_last_error();
        
        echo json_encode([
            'success' => false,
            'error' => $lastError ?: 'Connection failed',
            'details' => $errors
        ]);
        exit;
    }
    
    // Get mailbox info
    $check = imap_check($imap);
    $status = imap_status($imap, $connectionString, SA_ALL);
    
    // Get folder list
    $folders = imap_list($imap, '{' . $host . ':' . $port . $flags . '}', '*');
    $folderNames = [];
    if ($folders) {
        foreach ($folders as $f) {
            $folderNames[] = str_replace('{' . $host . ':' . $port . $flags . '}', '', $f);
        }
    }
    
    // Get recent/unseen count
    $recent = $check->Recent ?? 0;
    $unseen = $status->unseen ?? 0;
    $total = $status->messages ?? 0;
    
    imap_close($imap);
    
    echo json_encode([
        'success' => true,
        'message' => 'IMAP connection successful',
        'messageCount' => $total,
        'unseenCount' => $unseen,
        'recentCount' => $recent,
        'folders' => $folderNames,
        'mailbox' => $check->Mailbox ?? $folder
    ]);
    
} catch (Exception $e) {
    restore_error_handler();
    
    // Clean up any IMAP errors
    $errors = imap_errors();
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'details' => $errors
    ]);
}

<?php
/**
 * Realtime Email Polling Endpoint
 * GET /api/emails/realtime-poll.php?token=xxx&email=xxx&since=timestamp
 * 
 * Ultra-fast polling endpoint for instant email delivery
 * Uses long-polling with server-sent events fallback
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

// Disable output buffering for streaming
if (ob_get_level()) ob_end_clean();

// Set headers for long-polling
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

Response::setCorsHeaders();

$token = $_GET['token'] ?? '';
$emailAddress = $_GET['email'] ?? '';
$since = $_GET['since'] ?? null;
$mode = $_GET['mode'] ?? 'poll'; // poll or sse

if (empty($token)) {
    Response::error('Access token is required');
}

try {
    $tokenHash = hash('sha256', $token);
    
    // Validate token and get temp email
    $sql = "SELECT te.* FROM temp_emails te
            WHERE te.token_hash = ? AND te.is_active = 1";
    $params = [$tokenHash];
    
    if (!empty($emailAddress)) {
        $sql .= " AND te.email = ?";
        $params[] = $emailAddress;
    }
    
    $tempEmail = Database::fetchOne($sql, $params);
    
    if (!$tempEmail) {
        Response::error('Invalid or expired email token', 401);
    }
    
    // Check if expired
    if (strtotime($tempEmail['expires_at']) < time()) {
        Response::error('Email has expired', 410);
    }
    
    // SSE mode - keep connection open
    if ($mode === 'sse') {
        header('Content-Type: text/event-stream');
        header('X-Accel-Buffering: no');
        
        $lastCheck = $since ? date('Y-m-d H:i:s', (int) $since) : date('Y-m-d H:i:s', time() - 1);
        $timeout = 30; // 30 seconds max
        $startTime = time();
        $checkInterval = 500000; // 0.5 seconds in microseconds
        
        while ((time() - $startTime) < $timeout) {
            // Check for new emails
            $newEmails = Database::fetchAll(
                "SELECT re.*, 
                        (SELECT COUNT(*) FROM email_attachments WHERE email_id = re.id) as attachment_count
                 FROM received_emails re
                 WHERE re.temp_email_id = ? AND re.received_at > ?
                 ORDER BY re.received_at DESC
                 LIMIT 10",
                [$tempEmail['id'], $lastCheck]
            );
            
            if (!empty($newEmails)) {
                $formattedEmails = [];
                foreach ($newEmails as $email) {
                    $decrypted = Encryption::decryptEmail($email);
                    $formattedEmails[] = formatEmail($email, $decrypted);
                    $lastCheck = max($lastCheck, $email['received_at']);
                }
                
                echo "event: emails\n";
                echo "data: " . json_encode(['emails' => $formattedEmails]) . "\n\n";
                
                if (function_exists('fastcgi_finish_request')) {
                    flush();
                } else {
                    ob_flush();
                    flush();
                }
            }
            
            // Send heartbeat every 10 seconds
            if ((time() - $startTime) % 10 === 0) {
                echo ": heartbeat\n\n";
                flush();
            }
            
            // Check if client disconnected
            if (connection_aborted()) {
                break;
            }
            
            usleep($checkInterval);
        }
        
        echo "event: timeout\n";
        echo "data: {\"reconnect\": true}\n\n";
        exit;
    }
    
    // Standard long-polling mode
    $lastCheck = $since ? date('Y-m-d H:i:s', (int) $since) : date('Y-m-d H:i:s', time() - 60);
    $timeout = 25; // 25 seconds max (shorter than typical 30s timeout)
    $startTime = time();
    $checkInterval = 300000; // 0.3 seconds in microseconds - super fast!
    
    while ((time() - $startTime) < $timeout) {
        // Quick check for new emails
        $newEmails = Database::fetchAll(
            "SELECT re.*, 
                    (SELECT COUNT(*) FROM email_attachments WHERE email_id = re.id) as attachment_count
             FROM received_emails re
             WHERE re.temp_email_id = ? AND re.received_at > ?
             ORDER BY re.received_at DESC
             LIMIT 10",
            [$tempEmail['id'], $lastCheck]
        );
        
        if (!empty($newEmails)) {
            $formattedEmails = [];
            foreach ($newEmails as $email) {
                $decrypted = Encryption::decryptEmail($email);
                $formattedEmails[] = formatEmail($email, $decrypted);
            }
            
            Response::success([
                'emails' => $formattedEmails,
                'has_new' => true,
                'last_check' => time(),
                'temp_email' => [
                    'id' => $tempEmail['id'],
                    'email' => $tempEmail['email'],
                    'expires_at' => $tempEmail['expires_at']
                ]
            ], 'New emails found');
        }
        
        // Check if client disconnected
        if (connection_aborted()) {
            exit;
        }
        
        usleep($checkInterval);
    }
    
    // No new emails within timeout
    Response::success([
        'emails' => [],
        'has_new' => false,
        'last_check' => time(),
        'temp_email' => [
            'id' => $tempEmail['id'],
            'email' => $tempEmail['email'],
            'expires_at' => $tempEmail['expires_at']
        ]
    ], 'No new emails');
    
} catch (Exception $e) {
    error_log("Realtime poll error: " . $e->getMessage());
    Response::serverError('Failed to poll for emails');
}

function formatEmail($email, $decrypted) {
    return [
        'id' => $email['id'],
        'from_email' => $decrypted['from_email'] ?? $email['from_email_encrypted'] ?? 'Unknown',
        'from_name' => $decrypted['from_name'] ?? $email['from_name_encrypted'] ?? '',
        'subject' => $decrypted['subject'] ?? $email['subject_encrypted'] ?? '(No Subject)',
        'body_text' => $decrypted['body_text'] ?? null,
        'body_html' => $decrypted['body_html'] ?? null,
        'is_read' => (bool) $email['is_read'],
        'is_starred' => (bool) $email['is_starred'],
        'has_attachments' => $email['attachment_count'] > 0,
        'attachment_count' => (int) $email['attachment_count'],
        'received_at' => $email['received_at'],
        'created_at' => $email['created_at']
    ];
}

<?php
/**
 * Enhanced Email Webhook Receiver
 * POST /api/emails/webhook.php
 * 
 * Receives incoming emails from mail servers with support for:
 * - Mailgun, SendGrid, Postmark, Amazon SES, ForwardEmail
 * - Webhook signature verification
 * - Rate limiting
 * - Real-time push notifications
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

Response::setCorsHeaders();

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

Response::requireMethod('POST');

// Rate limiting
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitKey = "webhook_rate_$clientIp";
$rateLimit = 100; // requests per minute

try {
    // Check rate limit
    $recentRequests = Database::fetchOne(
        "SELECT COUNT(*) as count FROM webhook_logs 
         WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)",
        [$clientIp]
    );
    
    if ($recentRequests && $recentRequests['count'] > $rateLimit) {
        http_response_code(429);
        Response::error('Rate limit exceeded', 429);
    }
} catch (Exception $e) {
    // Continue if rate limit table doesn't exist
}

// Get content type and detect provider
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$provider = detectProvider();

try {
    // Verify webhook signature
    if (!verifyWebhookSignature($provider)) {
        logWebhook($clientIp, $provider, 'rejected', 'Invalid signature');
        Response::error('Invalid webhook signature', 401);
    }
    
    // Parse incoming email data based on provider
    $emailData = parseWebhookData($provider, $contentType);
    
    if (empty($emailData['recipient'])) {
        logWebhook($clientIp, $provider, 'rejected', 'No recipient');
        Response::error('Recipient email is required');
    }
    
    $recipientEmail = strtolower(trim($emailData['recipient']));
    
    // Find the temp email using optimized query
    $tempEmail = Database::fetchOne(
        "SELECT te.id, te.user_id, te.forward_to, d.domain 
         FROM temp_emails te
         INNER JOIN domains d ON d.id = te.domain_id
         WHERE te.email_address = ? AND te.is_active = 1 
         AND (te.expires_at IS NULL OR te.expires_at > NOW())
         LIMIT 1",
        [$recipientEmail]
    );
    
    if (!$tempEmail) {
        logWebhook($clientIp, $provider, 'rejected', 'Address not found: ' . $recipientEmail);
        Response::success(['accepted' => false, 'reason' => 'Address not found']);
    }
    
    // Prepare email data
    $emailContent = [
        'subject' => $emailData['subject'] ?? '(No Subject)',
        'from_email' => $emailData['from'] ?? $emailData['sender'] ?? 'unknown@unknown.com',
        'from_name' => $emailData['from_name'] ?? extractNameFromEmail($emailData['from'] ?? ''),
        'body_text' => $emailData['body_plain'] ?? $emailData['text'] ?? '',
        'body_html' => $emailData['body_html'] ?? $emailData['html'] ?? null
    ];
    
    // Encrypt email content
    $encrypted = Encryption::encryptEmail($emailContent);
    
    $emailId = Database::generateUUID();
    $now = date('Y-m-d H:i:s');
    
    // Store email with optimized insert
    Database::query(
        "INSERT INTO received_emails (
            id, temp_email_id, message_id, 
            from_address, from_name, to_address, subject,
            subject_encrypted, body_text_encrypted, body_html_encrypted,
            is_encrypted, is_read, is_starred, has_attachments,
            received_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, NOW(), NOW())",
        [
            $emailId,
            $tempEmail['id'],
            $emailData['message_id'] ?? $emailId,
            $emailContent['from_email'],
            $emailContent['from_name'],
            $recipientEmail,
            $emailContent['subject'],
            $encrypted['subject_encrypted'] ?? null,
            $encrypted['body_text_encrypted'] ?? null,
            $encrypted['body_html_encrypted'] ?? null,
            !empty($emailData['attachments']) ? 1 : 0
        ]
    );
    
    // Handle attachments
    $attachmentCount = 0;
    if (!empty($emailData['attachments'])) {
        $attachmentCount = processAttachments($emailId, $emailData['attachments']);
        if ($attachmentCount > 0) {
            Database::query(
                "UPDATE received_emails SET attachment_count = ? WHERE id = ?",
                [$attachmentCount, $emailId]
            );
        }
    }
    
    // Update last accessed
    Database::query(
        "UPDATE temp_emails SET last_accessed_at = NOW() WHERE id = ?",
        [$tempEmail['id']]
    );
    
    // Update stats atomically
    Database::query(
        "INSERT INTO email_stats (id, date, emails_received, created_at) 
         VALUES (UUID(), CURDATE(), 1, NOW())
         ON DUPLICATE KEY UPDATE emails_received = emails_received + 1",
        []
    );
    
    // Trigger real-time notification
    notifyNewEmail($tempEmail['id'], $emailId, $emailContent['subject']);
    
    // Handle email forwarding
    if (!empty($tempEmail['forward_to'])) {
        forwardEmail($tempEmail['forward_to'], $emailContent, $emailData['attachments'] ?? []);
    }
    
    // Log successful webhook
    logWebhook($clientIp, $provider, 'success', null, $emailId);
    
    Response::success([
        'accepted' => true,
        'email_id' => $emailId,
        'attachments' => $attachmentCount
    ], 'Email received successfully');
    
} catch (Exception $e) {
    error_log("Webhook error: " . $e->getMessage());
    logWebhook($clientIp, $provider, 'error', $e->getMessage());
    Response::serverError('Failed to process incoming email');
}

/**
 * Detect webhook provider from headers
 */
function detectProvider(): string {
    $headers = getallheaders();
    
    // Mailgun
    if (isset($headers['X-Mailgun-Signature']) || isset($_POST['signature'])) {
        return 'mailgun';
    }
    
    // SendGrid
    if (isset($headers['X-Twilio-Email-Event-Webhook-Signature'])) {
        return 'sendgrid';
    }
    
    // Postmark
    if (isset($headers['X-Postmark-Server-Token'])) {
        return 'postmark';
    }
    
    // Amazon SES
    if (isset($headers['X-Amz-Sns-Message-Type'])) {
        return 'ses';
    }
    
    // ForwardEmail
    if (isset($headers['X-Forward-Email-Signature'])) {
        return 'forwardemail';
    }
    
    // Custom/Generic
    if (isset($headers['X-Webhook-Secret'])) {
        return 'custom';
    }
    
    return 'unknown';
}

/**
 * Verify webhook signature based on provider
 */
function verifyWebhookSignature(string $provider): bool {
    $config = Database::getConfig();
    
    // Support both config structures for backwards compatibility
    $webhookSecrets = $config['webhooks']['secrets'] ?? $config['webhook_secrets'] ?? [];
    
    // Skip verification for unknown providers or if no secrets configured
    if ($provider === 'unknown' || empty($webhookSecrets)) {
        return true;
    }
    
    $secret = $webhookSecrets[$provider] ?? null;
    if (!$secret) {
        return true; // No secret configured for this provider
    }
    
    $headers = getallheaders();
    
    switch ($provider) {
        case 'mailgun':
            $signature = $_POST['signature'] ?? [];
            $timestamp = $signature['timestamp'] ?? '';
            $token = $signature['token'] ?? '';
            $sig = $signature['signature'] ?? '';
            $expectedSig = hash_hmac('sha256', $timestamp . $token, $secret);
            return hash_equals($expectedSig, $sig);
            
        case 'sendgrid':
            $signature = $headers['X-Twilio-Email-Event-Webhook-Signature'] ?? '';
            $timestamp = $headers['X-Twilio-Email-Event-Webhook-Timestamp'] ?? '';
            $payload = $timestamp . file_get_contents('php://input');
            $expectedSig = base64_encode(hash_hmac('sha256', $payload, base64_decode($secret), true));
            return hash_equals($expectedSig, $signature);
            
        case 'postmark':
            return $headers['X-Postmark-Server-Token'] === $secret;
            
        case 'custom':
            return $headers['X-Webhook-Secret'] === $secret;
            
        default:
            return true;
    }
}

/**
 * Parse webhook data based on provider
 */
function parseWebhookData(string $provider, string $contentType): array {
    switch ($provider) {
        case 'mailgun':
            return parseMailgun();
            
        case 'sendgrid':
            return parseSendGrid();
            
        case 'postmark':
            return parsePostmark();
            
        case 'ses':
            return parseSES();
            
        case 'forwardemail':
            return parseForwardEmail();
            
        default:
            return parseGeneric($contentType);
    }
}

/**
 * Parse Mailgun webhook
 */
function parseMailgun(): array {
    return [
        'recipient' => $_POST['recipient'] ?? $_POST['To'] ?? '',
        'from' => $_POST['from'] ?? $_POST['From'] ?? '',
        'from_name' => $_POST['from-name'] ?? '',
        'subject' => $_POST['subject'] ?? $_POST['Subject'] ?? '',
        'body_plain' => $_POST['body-plain'] ?? $_POST['stripped-text'] ?? '',
        'body_html' => $_POST['body-html'] ?? $_POST['stripped-html'] ?? '',
        'message_id' => $_POST['Message-Id'] ?? null,
        'attachments' => $_FILES['attachment'] ?? [],
        'headers' => json_decode($_POST['message-headers'] ?? '[]', true)
    ];
}

/**
 * Parse SendGrid webhook
 */
function parseSendGrid(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    if (is_array($data) && isset($data[0])) {
        $data = $data[0]; // SendGrid sends array of events
    }
    
    $envelope = json_decode($data['envelope'] ?? '{}', true);
    
    return [
        'recipient' => $envelope['to'][0] ?? $data['to'] ?? '',
        'from' => $data['from'] ?? '',
        'from_name' => '',
        'subject' => $data['subject'] ?? '',
        'body_plain' => $data['text'] ?? '',
        'body_html' => $data['html'] ?? '',
        'message_id' => $data['sg_message_id'] ?? null,
        'attachments' => $data['attachments'] ?? [],
        'spam_score' => $data['spam_score'] ?? null
    ];
}

/**
 * Parse Postmark webhook
 */
function parsePostmark(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    
    return [
        'recipient' => $data['OriginalRecipient'] ?? $data['To'] ?? '',
        'from' => $data['FromFull']['Email'] ?? $data['From'] ?? '',
        'from_name' => $data['FromFull']['Name'] ?? '',
        'subject' => $data['Subject'] ?? '',
        'body_plain' => $data['TextBody'] ?? '',
        'body_html' => $data['HtmlBody'] ?? '',
        'message_id' => $data['MessageID'] ?? null,
        'attachments' => $data['Attachments'] ?? [],
        'headers' => $data['Headers'] ?? []
    ];
}

/**
 * Parse Amazon SES webhook
 */
function parseSES(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Handle SNS notification wrapper
    if (isset($data['Message'])) {
        $data = json_decode($data['Message'], true);
    }
    
    $mail = $data['mail'] ?? $data;
    $content = $data['content'] ?? '';
    
    // Parse raw email if provided
    if ($content) {
        $parsed = parseRawEmail($content);
    } else {
        $parsed = [
            'recipient' => $mail['destination'][0] ?? '',
            'from' => $mail['source'] ?? '',
            'subject' => $mail['commonHeaders']['subject'] ?? '',
            'body_plain' => '',
            'body_html' => ''
        ];
    }
    
    $parsed['message_id'] = $mail['messageId'] ?? null;
    return $parsed;
}

/**
 * Parse ForwardEmail webhook
 */
function parseForwardEmail(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    
    return [
        'recipient' => $data['recipient'] ?? $data['to'] ?? '',
        'from' => $data['from'] ?? $data['sender'] ?? '',
        'from_name' => $data['from_name'] ?? '',
        'subject' => $data['subject'] ?? '',
        'body_plain' => $data['text'] ?? '',
        'body_html' => $data['html'] ?? '',
        'message_id' => $data['messageId'] ?? null,
        'attachments' => $data['attachments'] ?? []
    ];
}

/**
 * Parse generic webhook (form data or JSON)
 */
function parseGeneric(string $contentType): array {
    if (strpos($contentType, 'multipart/form-data') !== false) {
        return [
            'recipient' => $_POST['recipient'] ?? $_POST['to'] ?? $_POST['To'] ?? '',
            'from' => $_POST['from'] ?? $_POST['From'] ?? '',
            'from_name' => $_POST['from_name'] ?? '',
            'subject' => $_POST['subject'] ?? $_POST['Subject'] ?? '',
            'body_plain' => $_POST['body-plain'] ?? $_POST['text'] ?? $_POST['body'] ?? '',
            'body_html' => $_POST['body-html'] ?? $_POST['html'] ?? '',
            'message_id' => $_POST['Message-Id'] ?? $_POST['message-id'] ?? null,
            'attachments' => $_FILES['attachment'] ?? $_FILES['attachments'] ?? []
        ];
    } elseif (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
        return [
            'recipient' => $data['recipient'] ?? $data['to'] ?? '',
            'from' => $data['from'] ?? $data['sender'] ?? '',
            'from_name' => $data['from_name'] ?? '',
            'subject' => $data['subject'] ?? '',
            'body_plain' => $data['body_plain'] ?? $data['text'] ?? $data['body'] ?? '',
            'body_html' => $data['body_html'] ?? $data['html'] ?? '',
            'message_id' => $data['message_id'] ?? null,
            'attachments' => []
        ];
    } else {
        // Raw email
        return parseRawEmail(file_get_contents('php://input'));
    }
}

/**
 * Parse raw email (basic MIME parsing)
 */
function parseRawEmail(string $raw): array {
    $data = [
        'recipient' => '',
        'from' => '',
        'from_name' => '',
        'subject' => '',
        'body_plain' => '',
        'body_html' => ''
    ];
    
    // Split headers and body
    $parts = preg_split('/\r?\n\r?\n/', $raw, 2);
    $headers = $parts[0] ?? '';
    $body = $parts[1] ?? '';
    
    // Parse headers
    if (preg_match('/^To:\s*(.+)$/mi', $headers, $matches)) {
        $data['recipient'] = trim($matches[1]);
    }
    if (preg_match('/^From:\s*(.+)$/mi', $headers, $matches)) {
        $data['from'] = trim($matches[1]);
        $data['from_name'] = extractNameFromEmail($data['from']);
    }
    if (preg_match('/^Subject:\s*(.+)$/mi', $headers, $matches)) {
        $data['subject'] = trim($matches[1]);
    }
    if (preg_match('/^Message-ID:\s*(.+)$/mi', $headers, $matches)) {
        $data['message_id'] = trim($matches[1]);
    }
    
    $data['body_plain'] = $body;
    
    return $data;
}

/**
 * Extract name from email address
 */
function extractNameFromEmail(string $from): string {
    if (preg_match('/^"?([^"<]+)"?\s*</', $from, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

/**
 * Process and store attachments
 */
function processAttachments(string $emailId, $attachments): int {
    $config = Database::getConfig();
    $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
    $maxSize = ($config['uploads']['max_size_mb'] ?? 25) * 1024 * 1024;
    $allowedTypes = $config['uploads']['allowed_types'] ?? [];
    $count = 0;
    
    // Normalize attachments array
    if (isset($attachments['tmp_name'])) {
        if (is_array($attachments['tmp_name'])) {
            $files = [];
            for ($i = 0; $i < count($attachments['tmp_name']); $i++) {
                $files[] = [
                    'name' => $attachments['name'][$i],
                    'tmp_name' => $attachments['tmp_name'][$i],
                    'size' => $attachments['size'][$i],
                    'type' => $attachments['type'][$i]
                ];
            }
        } else {
            $files = [$attachments];
        }
    } elseif (is_array($attachments)) {
        // Postmark/API format
        $files = array_map(function($att) {
            return [
                'name' => $att['Name'] ?? $att['filename'] ?? 'attachment',
                'content' => $att['Content'] ?? $att['content'] ?? '',
                'type' => $att['ContentType'] ?? $att['content_type'] ?? 'application/octet-stream',
                'size' => strlen(base64_decode($att['Content'] ?? $att['content'] ?? ''))
            ];
        }, $attachments);
    } else {
        return 0;
    }
    
    foreach ($files as $file) {
        // Skip invalid files
        if (isset($file['tmp_name']) && (!is_uploaded_file($file['tmp_name']) || empty($file['tmp_name']))) {
            continue;
        }
        
        $size = $file['size'] ?? 0;
        if ($size > $maxSize || $size === 0) {
            continue;
        }
        
        $attachmentId = Database::generateUUID();
        $extension = pathinfo($file['name'] ?? 'file', PATHINFO_EXTENSION) ?: 'bin';
        $storagePath = 'attachments/' . date('Y/m/d') . '/' . $attachmentId . '.' . $extension;
        $fullPath = $uploadPath . '/' . $storagePath;
        
        // Create directory
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        
        // Handle file vs base64 content
        $saved = false;
        if (isset($file['tmp_name']) && is_uploaded_file($file['tmp_name'])) {
            $saved = move_uploaded_file($file['tmp_name'], $fullPath);
            $mimeType = mime_content_type($fullPath);
        } elseif (isset($file['content'])) {
            $content = base64_decode($file['content']);
            $saved = file_put_contents($fullPath, $content) !== false;
            $mimeType = $file['type'] ?? 'application/octet-stream';
        }
        
        if ($saved) {
            Database::insert('email_attachments', [
                'id' => $attachmentId,
                'email_id' => $emailId,
                'filename' => $attachmentId . '.' . $extension,
                'original_filename' => $file['name'] ?? 'attachment.' . $extension,
                'mime_type' => $mimeType ?? 'application/octet-stream',
                'size_bytes' => filesize($fullPath),
                'storage_path' => $storagePath,
                'is_encrypted' => 0,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            $count++;
        }
    }
    
    return $count;
}

/**
 * Notify about new email (for real-time updates)
 */
function notifyNewEmail(string $tempEmailId, string $emailId, string $subject): void {
    try {
        // Store notification for SSE/polling
        Database::query(
            "INSERT INTO email_notifications (id, temp_email_id, email_id, subject, created_at) 
             VALUES (UUID(), ?, ?, ?, NOW())",
            [$tempEmailId, $emailId, substr($subject, 0, 255)]
        );
        
        // Clean old notifications (keep last hour)
        Database::query(
            "DELETE FROM email_notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
    } catch (Exception $e) {
        // Notification table might not exist
        error_log("Notification error: " . $e->getMessage());
    }
}

/**
 * Forward email to specified address
 */
function forwardEmail(string $forwardTo, array $emailContent, array $attachments): void {
    try {
        require_once dirname(__DIR__) . '/core/mailer.php';
        
        $mailer = new Mailer();
        $mailer->sendRaw(
            $forwardTo,
            'Fwd: ' . $emailContent['subject'],
            $emailContent['body_html'] ?? $emailContent['body_text'],
            $emailContent['body_text'],
            ['replyTo' => $emailContent['from_email']]
        );
    } catch (Exception $e) {
        error_log("Forward email error: " . $e->getMessage());
    }
}

/**
 * Log webhook request
 */
function logWebhook(string $ip, string $provider, string $status, ?string $error = null, ?string $emailId = null): void {
    try {
        Database::query(
            "INSERT INTO webhook_logs (id, ip_address, provider, status, error_message, email_id, created_at)
             VALUES (UUID(), ?, ?, ?, ?, ?, NOW())",
            [$ip, $provider, $status, $error, $emailId]
        );
    } catch (Exception $e) {
        // Table might not exist
        error_log("Webhook log error: " . $e->getMessage());
    }
}

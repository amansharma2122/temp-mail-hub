<?php
/**
 * Email Webhook Receiver
 * Receives emails via HTTP POST from mail servers (Mailgun, SendGrid, etc.)
 */

require_once __DIR__ . '/../index.php';

/**
 * Parse email address from various formats
 */
function parseEmailAddress($address) {
    if (preg_match('/<(.+)>/', $address, $matches)) {
        return strtolower(trim($matches[1]));
    }
    return strtolower(trim($address));
}

/**
 * Encrypt text using AES-256-GCM
 */
function encryptEmailContent($text, $key) {
    if (empty($text)) return null;
    
    $iv = random_bytes(12);
    $encrypted = openssl_encrypt($text, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    
    return base64_encode($iv . $tag . $encrypted);
}

/**
 * Process incoming email webhook
 */
function handleEmailWebhook($pdo, $data) {
    $encryptionKey = getenv('ENCRYPTION_KEY') ?: 'default-encryption-key-change-me!';
    
    // Parse email data based on provider format
    $recipient = null;
    $sender = null;
    $subject = null;
    $body = null;
    $htmlBody = null;
    $attachments = [];
    
    // Mailgun format
    if (isset($data['recipient'])) {
        $recipient = parseEmailAddress($data['recipient']);
        $sender = parseEmailAddress($data['sender'] ?? $data['from'] ?? '');
        $subject = $data['subject'] ?? '(No Subject)';
        $body = $data['body-plain'] ?? $data['stripped-text'] ?? '';
        $htmlBody = $data['body-html'] ?? $data['stripped-html'] ?? '';
    }
    // SendGrid format
    elseif (isset($data['to'])) {
        $recipient = parseEmailAddress($data['to']);
        $sender = parseEmailAddress($data['from'] ?? '');
        $subject = $data['subject'] ?? '(No Subject)';
        $body = $data['text'] ?? '';
        $htmlBody = $data['html'] ?? '';
    }
    // Generic format
    elseif (isset($data['envelope'])) {
        $envelope = is_string($data['envelope']) ? json_decode($data['envelope'], true) : $data['envelope'];
        $recipient = parseEmailAddress($envelope['to'][0] ?? '');
        $sender = parseEmailAddress($envelope['from'] ?? '');
        $subject = $data['subject'] ?? '(No Subject)';
        $body = $data['plain'] ?? $data['text'] ?? '';
        $htmlBody = $data['html'] ?? '';
    }
    
    if (!$recipient || !$sender) {
        return ['success' => false, 'error' => 'Missing recipient or sender'];
    }
    
    // Find matching temp_email
    $stmt = $pdo->prepare("
        SELECT id, user_id, is_active, expires_at 
        FROM temp_emails 
        WHERE address = ? AND is_active = 1 AND expires_at > NOW()
    ");
    $stmt->execute([$recipient]);
    $tempEmail = $stmt->fetch();
    
    if (!$tempEmail) {
        // Log rejected email
        error_log("Webhook: Rejected email to unknown/expired address: $recipient");
        return ['success' => false, 'error' => 'Recipient not found or expired'];
    }
    
    // Encrypt sensitive content
    $encryptedSubject = encryptEmailContent($subject, $encryptionKey);
    $encryptedBody = encryptEmailContent($body, $encryptionKey);
    $encryptedHtml = encryptEmailContent($htmlBody, $encryptionKey);
    
    // Insert received email
    $stmt = $pdo->prepare("
        INSERT INTO received_emails (
            temp_email_id, from_address, subject, body, html_body, 
            is_encrypted, received_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW())
    ");
    
    $stmt->execute([
        $tempEmail['id'],
        $sender,
        $encryptedSubject ?? $subject,
        $encryptedBody ?? $body,
        $encryptedHtml ?? $htmlBody
    ]);
    
    $emailId = $pdo->lastInsertId();
    
    // Process attachments if present
    if (isset($data['attachments']) && is_array($data['attachments'])) {
        $storagePath = __DIR__ . '/../storage/attachments';
        if (!is_dir($storagePath)) {
            mkdir($storagePath, 0755, true);
        }
        
        foreach ($data['attachments'] as $attachment) {
            $fileName = $attachment['filename'] ?? $attachment['name'] ?? 'attachment';
            $fileType = $attachment['content-type'] ?? $attachment['type'] ?? 'application/octet-stream';
            $fileContent = base64_decode($attachment['content'] ?? $attachment['data'] ?? '');
            $fileSize = strlen($fileContent);
            
            // Generate unique storage path
            $uniqueName = uniqid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $fileName);
            $fullPath = "$storagePath/$uniqueName";
            
            // Save file
            file_put_contents($fullPath, $fileContent);
            
            // Insert attachment record
            $stmt = $pdo->prepare("
                INSERT INTO email_attachments (
                    received_email_id, file_name, file_type, file_size, storage_path
                ) VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$emailId, $fileName, $fileType, $fileSize, $uniqueName]);
        }
    }
    
    // Update email stats
    $stmt = $pdo->prepare("
        INSERT INTO email_stats (stat_key, stat_value, updated_at) 
        VALUES ('emails_received', 1, NOW())
        ON DUPLICATE KEY UPDATE stat_value = stat_value + 1, updated_at = NOW()
    ");
    $stmt->execute();
    
    return [
        'success' => true,
        'email_id' => $emailId,
        'recipient' => $recipient,
        'message' => 'Email received and stored'
    ];
}

// Handle POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Get config and PDO
        $config = require __DIR__ . '/../config.php';
        $pdo = new PDO(
            "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset=utf8mb4",
            $config['db']['user'],
            $config['db']['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        
        // Parse request data
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $data = [];
        
        if (strpos($contentType, 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
        } elseif (strpos($contentType, 'multipart/form-data') !== false) {
            $data = $_POST;
            // Handle file attachments
            if (!empty($_FILES)) {
                $data['attachments'] = [];
                foreach ($_FILES as $key => $file) {
                    if (is_array($file['name'])) {
                        for ($i = 0; $i < count($file['name']); $i++) {
                            $data['attachments'][] = [
                                'filename' => $file['name'][$i],
                                'content-type' => $file['type'][$i],
                                'content' => base64_encode(file_get_contents($file['tmp_name'][$i]))
                            ];
                        }
                    } else {
                        $data['attachments'][] = [
                            'filename' => $file['name'],
                            'content-type' => $file['type'],
                            'content' => base64_encode(file_get_contents($file['tmp_name']))
                        ];
                    }
                }
            }
        } else {
            $data = $_POST;
        }
        
        // Verify webhook signature if configured
        $webhookSecret = $config['webhook_secret'] ?? null;
        if ($webhookSecret) {
            $signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? 
                         $_SERVER['HTTP_X_MAILGUN_SIGNATURE'] ?? 
                         $_SERVER['HTTP_X_TWILIO_EMAIL_EVENT_WEBHOOK_SIGNATURE'] ?? '';
            
            // Mailgun signature verification
            if (isset($data['timestamp']) && isset($data['token'])) {
                $expectedSignature = hash_hmac('sha256', $data['timestamp'] . $data['token'], $webhookSecret);
                if (!hash_equals($expectedSignature, $data['signature'] ?? '')) {
                    http_response_code(401);
                    echo json_encode(['success' => false, 'error' => 'Invalid signature']);
                    exit;
                }
            }
        }
        
        // Process the email
        $result = handleEmailWebhook($pdo, $data);
        
        http_response_code($result['success'] ? 200 : 400);
        header('Content-Type: application/json');
        echo json_encode($result);
        
    } catch (Exception $e) {
        error_log("Webhook error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Internal server error']);
    }
} else {
    // Return 405 for non-POST requests
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}

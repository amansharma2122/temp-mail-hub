<?php
/**
 * Email Webhook Receiver
 * POST /api/emails/webhook.php
 * 
 * Receives incoming emails from mail server (Mailgun, SendGrid, etc.)
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

// Get content type
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

try {
    // Parse incoming email data based on content type
    if (strpos($contentType, 'multipart/form-data') !== false) {
        // Mailgun/SendGrid format
        $emailData = parseFormData();
    } elseif (strpos($contentType, 'application/json') !== false) {
        // JSON format
        $emailData = Response::getJsonInput();
    } else {
        // Raw email format
        $emailData = parseRawEmail(file_get_contents('php://input'));
    }
    
    if (empty($emailData['recipient'])) {
        Response::error('Recipient email is required');
    }
    
    $recipientEmail = strtolower(trim($emailData['recipient']));
    
    // Find the temp email
    $tempEmail = Database::fetchOne(
        "SELECT te.*, d.domain 
         FROM temp_emails te
         JOIN domains d ON d.id = te.domain_id
         WHERE te.email = ? AND te.is_active = 1 AND te.expires_at > NOW()",
        [$recipientEmail]
    );
    
    if (!$tempEmail) {
        // Log rejected email
        error_log("Webhook: Rejected email for non-existent address: " . $recipientEmail);
        Response::success(['accepted' => false, 'reason' => 'Address not found']);
    }
    
    // Prepare email data for encryption
    $emailContent = [
        'subject' => $emailData['subject'] ?? '(No Subject)',
        'from_email' => $emailData['from'] ?? $emailData['sender'] ?? 'unknown@unknown.com',
        'from_name' => $emailData['from_name'] ?? extractNameFromEmail($emailData['from'] ?? ''),
        'body_text' => $emailData['body_plain'] ?? $emailData['text'] ?? '',
        'body_html' => $emailData['body_html'] ?? $emailData['html'] ?? null
    ];
    
    // Encrypt email content
    $encrypted = Encryption::encryptEmail($emailContent);
    
    // Store email
    $emailId = Database::insert('received_emails', [
        'id' => Database::generateUUID(),
        'temp_email_id' => $tempEmail['id'],
        'message_id' => $emailData['message_id'] ?? Database::generateUUID(),
        'from_email_encrypted' => $encrypted['from_email_encrypted'],
        'from_name_encrypted' => $encrypted['from_name_encrypted'] ?? null,
        'subject_encrypted' => $encrypted['subject_encrypted'],
        'body_text_encrypted' => $encrypted['body_text_encrypted'] ?? null,
        'body_html_encrypted' => $encrypted['body_html_encrypted'] ?? null,
        'is_encrypted' => 1,
        'is_read' => 0,
        'is_starred' => 0,
        'received_at' => date('Y-m-d H:i:s'),
        'created_at' => date('Y-m-d H:i:s')
    ]);
    
    // Handle attachments
    if (!empty($emailData['attachments'])) {
        processAttachments($emailId, $emailData['attachments']);
    }
    
    // Update stats
    Database::query(
        "INSERT INTO email_stats (id, date, emails_received, created_at) 
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE emails_received = emails_received + 1",
        [Database::generateUUID(), date('Y-m-d')]
    );
    
    Response::success([
        'accepted' => true,
        'email_id' => $emailId
    ], 'Email received successfully');
    
} catch (Exception $e) {
    error_log("Webhook error: " . $e->getMessage());
    Response::serverError('Failed to process incoming email');
}

/**
 * Parse multipart form data (Mailgun/SendGrid)
 */
function parseFormData(): array {
    return [
        'recipient' => $_POST['recipient'] ?? $_POST['To'] ?? '',
        'from' => $_POST['from'] ?? $_POST['From'] ?? '',
        'from_name' => $_POST['from_name'] ?? '',
        'subject' => $_POST['subject'] ?? $_POST['Subject'] ?? '',
        'body_plain' => $_POST['body-plain'] ?? $_POST['text'] ?? '',
        'body_html' => $_POST['body-html'] ?? $_POST['html'] ?? '',
        'message_id' => $_POST['Message-Id'] ?? $_POST['message-id'] ?? null,
        'attachments' => $_FILES['attachment'] ?? []
    ];
}

/**
 * Parse raw email (basic MIME parsing)
 */
function parseRawEmail(string $raw): array {
    $data = [
        'recipient' => '',
        'from' => '',
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
    }
    if (preg_match('/^Subject:\s*(.+)$/mi', $headers, $matches)) {
        $data['subject'] = trim($matches[1]);
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
function processAttachments(string $emailId, array $attachments): void {
    $config = Database::getConfig();
    $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
    $maxSize = ($config['uploads']['max_size_mb'] ?? 25) * 1024 * 1024;
    $allowedTypes = $config['uploads']['allowed_types'] ?? [];
    
    // Handle both single and multiple files
    $files = is_array($attachments['name'] ?? null) ? $attachments : [$attachments];
    
    foreach ($files as $file) {
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            continue;
        }
        
        if ($file['size'] > $maxSize) {
            continue;
        }
        
        $mimeType = mime_content_type($file['tmp_name']);
        if (!empty($allowedTypes) && !in_array($mimeType, $allowedTypes)) {
            continue;
        }
        
        $attachmentId = Database::generateUUID();
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $storagePath = 'attachments/' . date('Y/m/d') . '/' . $attachmentId . '.' . $extension;
        $fullPath = $uploadPath . '/' . $storagePath;
        
        // Create directory if needed
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        
        // Move file
        if (move_uploaded_file($file['tmp_name'], $fullPath)) {
            Database::insert('email_attachments', [
                'id' => $attachmentId,
                'email_id' => $emailId,
                'filename' => $file['name'],
                'mime_type' => $mimeType,
                'size' => $file['size'],
                'storage_path' => $storagePath,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        }
    }
}

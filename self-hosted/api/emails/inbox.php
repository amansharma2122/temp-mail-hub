<?php
/**
 * Get Inbox Emails
 * GET /api/emails/inbox.php?token=xxx&email=xxx
 * 
 * Fetches all emails for a temporary email address
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

Response::setCorsHeaders();
Response::requireMethod('GET');

$token = $_GET['token'] ?? '';
$emailAddress = $_GET['email'] ?? '';
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(50, max(10, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

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
    
    // Get total count
    $totalCount = Database::fetchOne(
        "SELECT COUNT(*) as count FROM received_emails WHERE temp_email_id = ?",
        [$tempEmail['id']]
    );
    
    // Fetch emails with pagination
    $emails = Database::fetchAll(
        "SELECT re.*, 
                (SELECT COUNT(*) FROM email_attachments WHERE email_id = re.id) as attachment_count
         FROM received_emails re
         WHERE re.temp_email_id = ?
         ORDER BY re.received_at DESC
         LIMIT ? OFFSET ?",
        [$tempEmail['id'], $limit, $offset]
    );
    
    // Decrypt emails and format response
    $formattedEmails = [];
    foreach ($emails as $email) {
        $decrypted = Encryption::decryptEmail($email);
        
        $formattedEmails[] = [
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
    
    Response::success([
        'emails' => $formattedEmails,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => (int) $totalCount['count'],
            'total_pages' => ceil($totalCount['count'] / $limit)
        ],
        'temp_email' => [
            'id' => $tempEmail['id'],
            'email' => $tempEmail['email'],
            'expires_at' => $tempEmail['expires_at']
        ]
    ], 'Inbox retrieved successfully');
    
} catch (Exception $e) {
    error_log("Inbox error: " . $e->getMessage());
    Response::serverError('Failed to fetch inbox');
}

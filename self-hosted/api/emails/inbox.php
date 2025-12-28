<?php
/**
 * Get Inbox Emails - OPTIMIZED FOR SPEED
 * GET /api/emails/inbox.php?token=xxx&email=xxx
 * 
 * Ultra-fast email fetching with caching and optimized queries
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

// Aggressive caching headers for API responses
header('Cache-Control: private, max-age=2');

Response::setCorsHeaders();
Response::requireMethod('GET');

$token = $_GET['token'] ?? '';
$emailAddress = $_GET['email'] ?? '';
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(10, (int) ($_GET['limit'] ?? 50))); // Increased default limit
$offset = ($page - 1) * $limit;
$since = $_GET['since'] ?? null; // For incremental fetching

if (empty($token)) {
    Response::error('Access token is required');
}

try {
    $tokenHash = hash('sha256', $token);
    
    // Optimized single query with JOIN - faster than subquery
    // Using correct column name email_address
    $sql = "SELECT te.id, te.email_address, te.expires_at, te.is_active 
            FROM temp_emails te
            WHERE te.token_hash = ? AND te.is_active = 1";
    $params = [$tokenHash];
    
    if (!empty($emailAddress)) {
        $sql .= " AND te.email_address = ?";
        $params[] = $emailAddress;
    }
    
    // Use query cache hint
    $tempEmail = Database::fetchOne($sql, $params);
    
    if (!$tempEmail) {
        Response::error('Invalid or expired email token', 401);
    }
    
    // Quick expiry check
    if (strtotime($tempEmail['expires_at']) < time()) {
        Response::error('Email has expired', 410);
    }
    
    // Build optimized query based on whether we need incremental fetch
    $emailQuery = "SELECT 
            re.id,
            re.from_email_encrypted,
            re.from_name_encrypted,
            re.subject_encrypted,
            re.body_text_encrypted,
            re.body_html_encrypted,
            re.encryption_iv,
            re.is_read,
            re.is_starred,
            re.received_at,
            re.created_at,
            COALESCE(ac.cnt, 0) as attachment_count
         FROM received_emails re
         LEFT JOIN (
            SELECT email_id, COUNT(*) as cnt 
            FROM email_attachments 
            GROUP BY email_id
         ) ac ON ac.email_id = re.id
         WHERE re.temp_email_id = ?";
    
    $emailParams = [$tempEmail['id']];
    
    // Incremental fetch for real-time updates
    if ($since) {
        $emailQuery .= " AND re.received_at > ?";
        $emailParams[] = date('Y-m-d H:i:s', (int) $since);
    }
    
    $emailQuery .= " ORDER BY re.received_at DESC LIMIT ? OFFSET ?";
    $emailParams[] = $limit;
    $emailParams[] = $offset;
    
    $emails = Database::fetchAll($emailQuery, $emailParams);
    
    // Get total count only if needed (skip for incremental fetch)
    $totalCount = 0;
    if (!$since) {
        $countResult = Database::fetchOne(
            "SELECT COUNT(*) as count FROM received_emails WHERE temp_email_id = ?",
            [$tempEmail['id']]
        );
        $totalCount = (int) $countResult['count'];
    }
    
    // Batch decrypt emails for speed
    $formattedEmails = [];
    foreach ($emails as $email) {
        $decrypted = Encryption::decryptEmail($email);
        
        $formattedEmails[] = [
            'id' => $email['id'],
            'from_email' => $decrypted['from_email'] ?? 'Unknown',
            'from_name' => $decrypted['from_name'] ?? '',
            'subject' => $decrypted['subject'] ?? '(No Subject)',
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
            'total' => $totalCount,
            'total_pages' => $totalCount > 0 ? ceil($totalCount / $limit) : 0
        ],
        'temp_email' => [
            'id' => $tempEmail['id'],
            'email' => $tempEmail['email_address'], // Using correct column name
            'expires_at' => $tempEmail['expires_at']
        ],
        'server_time' => time()
    ], 'Inbox retrieved successfully');
    
} catch (Exception $e) {
    error_log("Inbox error: " . $e->getMessage());
    Response::serverError('Failed to fetch inbox');
}

<?php
/**
 * Validate Temporary Email Token
 * POST /api/emails/validate.php
 * 
 * Validates access token and returns email info
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$input = Response::getJsonInput();
$token = $input['token'] ?? '';
$emailAddress = $input['email'] ?? '';

if (empty($token)) {
    Response::error('Access token is required');
}

try {
    $tokenHash = hash('sha256', $token);
    
    // Build query
    $sql = "SELECT te.*, d.domain as domain_name 
            FROM temp_emails te
            JOIN domains d ON d.id = te.domain_id
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
        // Mark as inactive
        Database::update(
            'temp_emails',
            ['is_active' => 0],
            'id = ?',
            [$tempEmail['id']]
        );
        
        Response::error('Email has expired', 410);
    }
    
    // Get unread count
    $unreadCount = Database::fetchOne(
        "SELECT COUNT(*) as count FROM received_emails 
         WHERE temp_email_id = ? AND is_read = 0",
        [$tempEmail['id']]
    );
    
    Response::success([
        'valid' => true,
        'id' => $tempEmail['id'],
        'email' => $tempEmail['email'],
        'domain' => $tempEmail['domain_name'],
        'expires_at' => $tempEmail['expires_at'],
        'is_active' => (bool) $tempEmail['is_active'],
        'unread_count' => (int) $unreadCount['count'],
        'created_at' => $tempEmail['created_at']
    ], 'Token validated successfully');
    
} catch (Exception $e) {
    error_log("Validate email error: " . $e->getMessage());
    Response::serverError('Validation failed');
}

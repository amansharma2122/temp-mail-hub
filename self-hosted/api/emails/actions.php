<?php
/**
 * Delete Email / Mark as Read / Star Email
 * POST /api/emails/actions.php
 * 
 * Actions: delete, mark_read, mark_unread, star, unstar
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$input = Response::getJsonInput();
$token = $input['token'] ?? '';
$emailId = $input['email_id'] ?? '';
$action = $input['action'] ?? '';

if (empty($token)) {
    Response::error('Access token is required');
}

if (empty($emailId)) {
    Response::error('Email ID is required');
}

if (empty($action)) {
    Response::error('Action is required');
}

try {
    $tokenHash = hash('sha256', $token);
    
    // Validate token and get temp email
    $tempEmail = Database::fetchOne(
        "SELECT te.* FROM temp_emails te WHERE te.token_hash = ? AND te.is_active = 1",
        [$tokenHash]
    );
    
    if (!$tempEmail) {
        Response::error('Invalid or expired email token', 401);
    }
    
    // Verify the email belongs to this temp email
    $email = Database::fetchOne(
        "SELECT * FROM received_emails WHERE id = ? AND temp_email_id = ?",
        [$emailId, $tempEmail['id']]
    );
    
    if (!$email) {
        Response::notFound('Email not found');
    }
    
    switch ($action) {
        case 'delete':
            // Delete attachments first
            $attachments = Database::fetchAll(
                "SELECT * FROM email_attachments WHERE email_id = ?",
                [$emailId]
            );
            
            $config = Database::getConfig();
            $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
            
            foreach ($attachments as $attachment) {
                $filePath = $uploadPath . '/' . $attachment['storage_path'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }
            
            Database::delete('email_attachments', 'email_id = ?', [$emailId]);
            Database::delete('received_emails', 'id = ?', [$emailId]);
            
            Response::success(null, 'Email deleted successfully');
            break;
            
        case 'mark_read':
            Database::update('received_emails', ['is_read' => 1], 'id = ?', [$emailId]);
            Response::success(null, 'Email marked as read');
            break;
            
        case 'mark_unread':
            Database::update('received_emails', ['is_read' => 0], 'id = ?', [$emailId]);
            Response::success(null, 'Email marked as unread');
            break;
            
        case 'star':
            Database::update('received_emails', ['is_starred' => 1], 'id = ?', [$emailId]);
            Response::success(null, 'Email starred');
            break;
            
        case 'unstar':
            Database::update('received_emails', ['is_starred' => 0], 'id = ?', [$emailId]);
            Response::success(null, 'Email unstarred');
            break;
            
        default:
            Response::error('Invalid action. Valid: delete, mark_read, mark_unread, star, unstar');
    }
    
} catch (Exception $e) {
    error_log("Email action error: " . $e->getMessage());
    Response::serverError('Failed to perform action');
}

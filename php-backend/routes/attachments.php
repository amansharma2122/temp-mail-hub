<?php
/**
 * Email Attachments Routes - PHP Backend
 * Handles attachment preview and download
 */

function handleAttachments($action, $method, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    // Also check for secret token header for guest access
    $secretToken = $_SERVER['HTTP_X_EMAIL_TOKEN'] ?? '';

    switch ($action) {
        case 'list':
            listAttachments($pdo, $userId, $secretToken, $isAdmin);
            break;
        case 'download':
            downloadAttachment($pdo, $userId, $secretToken, $isAdmin);
            break;
        case 'preview':
            previewAttachment($pdo, $userId, $secretToken, $isAdmin);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown attachment action']);
    }
}

/**
 * List attachments for an email
 */
function listAttachments($pdo, $userId, $secretToken, $isAdmin) {
    $emailId = $_GET['email_id'] ?? '';
    
    if (empty($emailId)) {
        http_response_code(400);
        echo json_encode(['error' => 'email_id required']);
        return;
    }

    // Verify access to email
    if (!verifyEmailAccess($pdo, $emailId, $userId, $secretToken, $isAdmin)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        return;
    }

    $stmt = $pdo->prepare("
        SELECT id, file_name, file_type, file_size, storage_path, created_at
        FROM email_attachments
        WHERE received_email_id = ?
        ORDER BY created_at ASC
    ");
    $stmt->execute([$emailId]);
    $attachments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($attachments);
}

/**
 * Download an attachment
 */
function downloadAttachment($pdo, $userId, $secretToken, $isAdmin) {
    $attachmentId = $_GET['id'] ?? '';
    
    if (empty($attachmentId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Attachment ID required']);
        return;
    }

    // Get attachment info
    $stmt = $pdo->prepare("
        SELECT ea.*, re.temp_email_id
        FROM email_attachments ea
        JOIN received_emails re ON ea.received_email_id = re.id
        WHERE ea.id = ?
    ");
    $stmt->execute([$attachmentId]);
    $attachment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$attachment) {
        http_response_code(404);
        echo json_encode(['error' => 'Attachment not found']);
        return;
    }

    // Verify access
    if (!verifyTempEmailAccess($pdo, $attachment['temp_email_id'], $userId, $secretToken, $isAdmin)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        return;
    }

    // Get file path
    $storagePath = $attachment['storage_path'];
    $uploadDir = __DIR__ . '/../uploads/attachments/';
    $filePath = $uploadDir . $storagePath;

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found on server']);
        return;
    }

    // Set headers for download
    header('Content-Type: ' . $attachment['file_type']);
    header('Content-Disposition: attachment; filename="' . addslashes($attachment['file_name']) . '"');
    header('Content-Length: ' . $attachment['file_size']);
    header('Cache-Control: private, max-age=3600');
    
    readfile($filePath);
    exit;
}

/**
 * Preview an attachment (for images, PDFs, text files)
 */
function previewAttachment($pdo, $userId, $secretToken, $isAdmin) {
    $attachmentId = $_GET['id'] ?? '';
    
    if (empty($attachmentId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Attachment ID required']);
        return;
    }

    // Get attachment info
    $stmt = $pdo->prepare("
        SELECT ea.*, re.temp_email_id
        FROM email_attachments ea
        JOIN received_emails re ON ea.received_email_id = re.id
        WHERE ea.id = ?
    ");
    $stmt->execute([$attachmentId]);
    $attachment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$attachment) {
        http_response_code(404);
        echo json_encode(['error' => 'Attachment not found']);
        return;
    }

    // Verify access
    if (!verifyTempEmailAccess($pdo, $attachment['temp_email_id'], $userId, $secretToken, $isAdmin)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        return;
    }

    // Check if file type is previewable
    $fileType = $attachment['file_type'];
    $previewable = (
        strpos($fileType, 'image/') === 0 ||
        $fileType === 'application/pdf' ||
        strpos($fileType, 'text/') === 0
    );

    if (!$previewable) {
        http_response_code(400);
        echo json_encode(['error' => 'File type not previewable', 'type' => $fileType]);
        return;
    }

    // Get file path
    $storagePath = $attachment['storage_path'];
    $uploadDir = __DIR__ . '/../uploads/attachments/';
    $filePath = $uploadDir . $storagePath;

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found on server']);
        return;
    }

    // Set headers for inline display
    header('Content-Type: ' . $attachment['file_type']);
    header('Content-Disposition: inline; filename="' . addslashes($attachment['file_name']) . '"');
    header('Content-Length: ' . $attachment['file_size']);
    header('Cache-Control: private, max-age=3600');
    
    readfile($filePath);
    exit;
}

/**
 * Verify user has access to an email
 */
function verifyEmailAccess($pdo, $emailId, $userId, $secretToken, $isAdmin) {
    if ($isAdmin) return true;

    $stmt = $pdo->prepare("
        SELECT te.user_id, te.secret_token
        FROM received_emails re
        JOIN temp_emails te ON re.temp_email_id = te.id
        WHERE re.id = ?
    ");
    $stmt->execute([$emailId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$result) return false;

    // User owns the temp email
    if ($userId && $result['user_id'] === $userId) return true;

    // Guest with valid token
    if ($secretToken && $result['secret_token'] === $secretToken) return true;

    return false;
}

/**
 * Verify user has access to a temp email
 */
function verifyTempEmailAccess($pdo, $tempEmailId, $userId, $secretToken, $isAdmin) {
    if ($isAdmin) return true;

    $stmt = $pdo->prepare("SELECT user_id, secret_token FROM temp_emails WHERE id = ?");
    $stmt->execute([$tempEmailId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$result) return false;

    // User owns the temp email
    if ($userId && $result['user_id'] === $userId) return true;

    // Guest with valid token
    if ($secretToken && $result['secret_token'] === $secretToken) return true;

    return false;
}

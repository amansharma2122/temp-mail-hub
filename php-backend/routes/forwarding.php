<?php
/**
 * Email Forwarding Routes - PHP Backend
 * Handles email forwarding with admin controls and subscription tier checks
 */

function handleForwarding($action, $method, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    switch ($action) {
        case 'check-eligibility':
            checkForwardingEligibility($pdo, $userId, $isAdmin);
            break;
        case 'rules':
            handleForwardingRules($method, $body, $pdo, $userId, $isAdmin);
            break;
        case 'admin/settings':
            handleAdminForwardingSettings($method, $body, $pdo, $isAdmin);
            break;
        case 'process':
            processForwardingQueue($pdo, $config, $isAdmin);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown forwarding action']);
    }
}

/**
 * Check if user can use email forwarding based on subscription tier
 */
function checkForwardingEligibility($pdo, $userId, $isAdmin) {
    if ($isAdmin) {
        echo json_encode(['eligible' => true, 'reason' => 'Admin access']);
        return;
    }

    if (!$userId) {
        echo json_encode(['eligible' => false, 'reason' => 'Authentication required']);
        return;
    }

    // Check if forwarding is globally enabled
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'forwarding_settings'");
    $stmt->execute();
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);
    $forwardingSettings = $settings ? json_decode($settings['value'], true) : [];
    
    if (!($forwardingSettings['enabled'] ?? true)) {
        echo json_encode(['eligible' => false, 'reason' => 'Email forwarding is currently disabled']);
        return;
    }

    // Check user subscription tier
    $stmt = $pdo->prepare("
        SELECT st.can_forward_emails, st.name as tier_name
        FROM user_subscriptions us
        JOIN subscription_tiers st ON us.tier_id = st.id
        WHERE us.user_id = ? AND us.status = 'active'
        ORDER BY us.created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$subscription) {
        echo json_encode([
            'eligible' => false, 
            'reason' => 'Email forwarding requires a Pro or Business subscription'
        ]);
        return;
    }

    if (!$subscription['can_forward_emails']) {
        echo json_encode([
            'eligible' => false, 
            'reason' => "Email forwarding is not available on the {$subscription['tier_name']} plan"
        ]);
        return;
    }

    echo json_encode(['eligible' => true, 'tier' => $subscription['tier_name']]);
}

/**
 * Handle CRUD operations for forwarding rules
 */
function handleForwardingRules($method, $body, $pdo, $userId, $isAdmin) {
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }

    switch ($method) {
        case 'GET':
            // Get user's forwarding rules
            $stmt = $pdo->prepare("
                SELECT ef.*, te.address as temp_email_address
                FROM email_forwarding ef
                JOIN temp_emails te ON ef.temp_email_id = te.id
                WHERE ef.user_id = ?
                ORDER BY ef.created_at DESC
            ");
            $stmt->execute([$userId]);
            $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($rules);
            break;

        case 'POST':
            // Create new forwarding rule
            $tempEmailId = $body['temp_email_id'] ?? '';
            $forwardTo = $body['forward_to_address'] ?? '';

            if (empty($tempEmailId) || empty($forwardTo)) {
                http_response_code(400);
                echo json_encode(['error' => 'temp_email_id and forward_to_address required']);
                return;
            }

            // Validate email format
            if (!filter_var($forwardTo, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid email address format']);
                return;
            }

            // Verify temp email belongs to user
            $stmt = $pdo->prepare("SELECT id FROM temp_emails WHERE id = ? AND user_id = ?");
            $stmt->execute([$tempEmailId, $userId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['error' => 'Temp email not found or not owned by user']);
                return;
            }

            // Check for existing rule
            $stmt = $pdo->prepare("SELECT id FROM email_forwarding WHERE temp_email_id = ?");
            $stmt->execute([$tempEmailId]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'A forwarding rule already exists for this email']);
                return;
            }

            // Create rule
            $ruleId = generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO email_forwarding (id, temp_email_id, forward_to_address, user_id, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, NOW(), NOW())
            ");
            $stmt->execute([$ruleId, $tempEmailId, $forwardTo, $userId]);

            // Return created rule with temp email address
            $stmt = $pdo->prepare("
                SELECT ef.*, te.address as temp_email_address
                FROM email_forwarding ef
                JOIN temp_emails te ON ef.temp_email_id = te.id
                WHERE ef.id = ?
            ");
            $stmt->execute([$ruleId]);
            $rule = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode($rule);
            break;

        case 'PATCH':
            // Update rule (toggle active status)
            $ruleId = $_GET['id'] ?? $body['id'] ?? '';
            $isActive = $body['is_active'] ?? null;

            if (empty($ruleId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Rule ID required']);
                return;
            }

            // Verify rule belongs to user
            $stmt = $pdo->prepare("SELECT id FROM email_forwarding WHERE id = ? AND user_id = ?");
            $stmt->execute([$ruleId, $userId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['error' => 'Rule not found or not owned by user']);
                return;
            }

            $stmt = $pdo->prepare("UPDATE email_forwarding SET is_active = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$isActive ? 1 : 0, $ruleId]);

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // Delete rule
            $ruleId = $_GET['id'] ?? '';

            if (empty($ruleId)) {
                http_response_code(400);
                echo json_encode(['error' => 'Rule ID required']);
                return;
            }

            // Verify rule belongs to user
            $stmt = $pdo->prepare("SELECT id FROM email_forwarding WHERE id = ? AND user_id = ?");
            $stmt->execute([$ruleId, $userId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['error' => 'Rule not found or not owned by user']);
                return;
            }

            $stmt = $pdo->prepare("DELETE FROM email_forwarding WHERE id = ?");
            $stmt->execute([$ruleId]);

            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Admin settings for email forwarding
 */
function handleAdminForwardingSettings($method, $body, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'forwarding_settings'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $settings = $row ? json_decode($row['value'], true) : [
            'enabled' => true,
            'require_email_verification' => true,
            'max_rules_per_user' => 5,
            'allowed_tiers' => ['pro', 'business'],
            'rate_limit_per_hour' => 100
        ];
        
        echo json_encode($settings);
    } else if ($method === 'POST' || $method === 'PATCH') {
        $settings = [
            'enabled' => $body['enabled'] ?? true,
            'require_email_verification' => $body['require_email_verification'] ?? true,
            'max_rules_per_user' => $body['max_rules_per_user'] ?? 5,
            'allowed_tiers' => $body['allowed_tiers'] ?? ['pro', 'business'],
            'rate_limit_per_hour' => $body['rate_limit_per_hour'] ?? 100
        ];

        $stmt = $pdo->prepare("
            INSERT INTO app_settings (id, `key`, value, updated_at)
            VALUES (?, 'forwarding_settings', ?, NOW())
            ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
        ");
        $stmt->execute([generateUUID(), json_encode($settings)]);

        echo json_encode(['success' => true, 'settings' => $settings]);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Process forwarding queue - forwards emails to users' personal addresses
 * Called by cron job
 */
function processForwardingQueue($pdo, $config, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $startTime = microtime(true);
    $forwarded = 0;
    $failed = 0;
    $errors = [];

    try {
        // Get active forwarding rules with unforwarded emails
        $stmt = $pdo->query("
            SELECT 
                ef.id as rule_id,
                ef.forward_to_address,
                ef.temp_email_id,
                te.address as temp_email_address,
                re.id as email_id,
                re.from_address,
                re.subject,
                re.body,
                re.html_body,
                re.received_at
            FROM email_forwarding ef
            JOIN temp_emails te ON ef.temp_email_id = te.id
            JOIN received_emails re ON re.temp_email_id = te.id
            LEFT JOIN email_forward_log efl ON efl.received_email_id = re.id AND efl.forwarding_rule_id = ef.id
            WHERE ef.is_active = 1 
              AND te.is_active = 1
              AND efl.id IS NULL
            ORDER BY re.received_at ASC
            LIMIT 50
        ");
        $toForward = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get SMTP settings
        $mailbox = $pdo->query("SELECT * FROM mailboxes WHERE is_active = 1 ORDER BY priority ASC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        
        if (!$mailbox && empty($config['smtp']['host'])) {
            echo json_encode(['error' => 'No SMTP configuration available']);
            return;
        }

        $smtpHost = $mailbox['smtp_host'] ?? $config['smtp']['host'] ?? '';
        $smtpPort = $mailbox['smtp_port'] ?? $config['smtp']['port'] ?? 587;
        $smtpUser = $mailbox['smtp_user'] ?? $config['smtp']['user'] ?? '';
        $smtpPass = $mailbox['smtp_password'] ?? $config['smtp']['pass'] ?? '';
        $smtpFrom = $mailbox['smtp_from'] ?? $config['smtp']['from'] ?? $smtpUser;

        foreach ($toForward as $email) {
            try {
                // Build forwarded email subject
                $subject = "[Forwarded] " . ($email['subject'] ?? 'No Subject');
                
                // Build body with original email info
                $body = "--- Forwarded from {$email['temp_email_address']} ---\n";
                $body .= "Original From: {$email['from_address']}\n";
                $body .= "Received: {$email['received_at']}\n";
                $body .= "---\n\n";
                $body .= $email['body'] ?? '';

                $html = null;
                if (!empty($email['html_body'])) {
                    $html = "<div style='padding: 10px; background: #f5f5f5; margin-bottom: 20px;'>";
                    $html .= "<p><strong>Forwarded from:</strong> {$email['temp_email_address']}</p>";
                    $html .= "<p><strong>Original From:</strong> {$email['from_address']}</p>";
                    $html .= "<p><strong>Received:</strong> {$email['received_at']}</p>";
                    $html .= "</div>";
                    $html .= $email['html_body'];
                }

                // Send email
                $result = sendSmtpEmail(
                    $smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpFrom,
                    $email['forward_to_address'], $subject, $body, $html
                );

                // Log the forwarding attempt
                $logId = generateUUID();
                $stmt = $pdo->prepare("
                    INSERT INTO email_forward_log (id, forwarding_rule_id, received_email_id, status, error_message, forwarded_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $logId,
                    $email['rule_id'],
                    $email['email_id'],
                    $result['success'] ? 'sent' : 'failed',
                    $result['error'] ?? null
                ]);

                if ($result['success']) {
                    $forwarded++;
                } else {
                    $failed++;
                    $errors[] = "Email {$email['email_id']}: {$result['error']}";
                }

            } catch (Exception $e) {
                $failed++;
                $errors[] = "Email {$email['email_id']}: " . $e->getMessage();
            }
        }

    } catch (Exception $e) {
        echo json_encode(['error' => $e->getMessage()]);
        return;
    }

    $duration = round((microtime(true) - $startTime) * 1000);

    echo json_encode([
        'success' => true,
        'stats' => [
            'forwarded' => $forwarded,
            'failed' => $failed,
            'duration_ms' => $duration
        ],
        'errors' => $errors
    ]);
}

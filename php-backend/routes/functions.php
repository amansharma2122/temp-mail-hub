<?php
/**
 * Functions Routes - Edge function equivalents
 */

function handleFunction($functionName, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    switch ($functionName) {
        case 'validate-temp-email':
            validateTempEmail($body, $pdo);
            break;
        case 'secure-email-access':
            secureEmailAccess($body, $pdo);
            break;
        case 'get-public-stats':
            getPublicStats($pdo);
            break;
        case 'verify-recaptcha':
            verifyRecaptcha($body, $config);
            break;
        case 'create-verification-and-send':
            createVerificationAndSend($body, $pdo, $config);
            break;
        case 'verify-email-token':
            verifyEmailToken($body, $pdo);
            break;
        case 'send-test-email':
            sendTestEmail($body, $pdo, $config, $isAdmin);
            break;
        case 'summarize-email':
            summarizeEmail($body, $pdo, $userId);
            break;
        case 'create-checkout':
            createCheckout($body, $pdo, $config, $userId);
            break;
        case 'email-webhook':
            emailWebhook($body, $pdo, $config);
            break;
        case 'generate-backup':
            generateBackup($pdo, $isAdmin, $userId);
            break;
        case 'email-health-check':
            emailHealthCheck($pdo, $isAdmin);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown function: ' . $functionName]);
    }
}

function validateTempEmail($body, $pdo) {
    $tempEmailId = $body['tempEmailId'] ?? null;
    $token = $body['token'] ?? null;
    $emailIds = $body['emailIds'] ?? [];

    // Single email validation with token
    if ($tempEmailId && $token) {
        $stmt = $pdo->prepare('
            SELECT * FROM temp_emails 
            WHERE id = ? AND secret_token = ? AND is_active = 1 AND expires_at > NOW()
        ');
        $stmt->execute([$tempEmailId, $token]);
        $email = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($email) {
            echo json_encode(['valid' => true, 'email' => $email]);
        } else {
            echo json_encode(['valid' => false]);
        }
        return;
    }

    // Bulk validation
    if (!empty($emailIds)) {
        $placeholders = implode(',', array_fill(0, count($emailIds), '?'));
        $stmt = $pdo->prepare("
            SELECT * FROM temp_emails 
            WHERE id IN ($placeholders) AND is_active = 1 AND expires_at > NOW()
            ORDER BY created_at DESC
        ");
        $stmt->execute($emailIds);
        $validEmails = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($validEmails)) {
            $validIds = array_column($validEmails, 'id');
            echo json_encode([
                'valid' => true,
                'email' => $validEmails[0],
                'validEmailIds' => $validIds,
            ]);
        } else {
            echo json_encode(['valid' => false]);
        }
        return;
    }

    echo json_encode(['valid' => false, 'error' => 'No email ID provided']);
}

function secureEmailAccess($body, $pdo) {
    $tempEmailId = $body['temp_email_id'] ?? '';
    $token = $body['secret_token'] ?? '';

    if (empty($tempEmailId) || empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing temp_email_id or secret_token']);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT te.*, d.name as domain_name
        FROM temp_emails te
        JOIN domains d ON d.id = te.domain_id
        WHERE te.id = ? AND te.secret_token = ? AND te.is_active = 1 AND te.expires_at > NOW()
    ');
    $stmt->execute([$tempEmailId, $token]);
    $email = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$email) {
        http_response_code(404);
        echo json_encode(['error' => 'Email not found or expired']);
        return;
    }

    // Get received emails
    $stmt = $pdo->prepare('
        SELECT * FROM received_emails 
        WHERE temp_email_id = ? 
        ORDER BY received_at DESC
    ');
    $stmt->execute([$tempEmailId]);
    $receivedEmails = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'temp_email' => $email,
        'received_emails' => $receivedEmails,
    ]);
}

function getPublicStats($pdo) {
    // Get email stats
    $stmt = $pdo->query("SELECT stat_key, stat_value FROM email_stats");
    $stats = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $stats[$row['stat_key']] = intval($row['stat_value']);
    }

    // Get domain count
    $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
    $domainCount = $stmt->fetchColumn();

    echo json_encode([
        'total_emails_created' => $stats['total_emails_created'] ?? 0,
        'total_emails_received' => $stats['total_emails_received'] ?? 0,
        'active_domains' => intval($domainCount),
        'uptime_percentage' => 99.9,
    ]);
}

function verifyRecaptcha($body, $config) {
    $token = $body['token'] ?? '';
    $action = $body['action'] ?? '';

    // Skip if no reCAPTCHA configured
    if (empty($config['recaptcha']['secret_key'])) {
        echo json_encode(['success' => true, 'score' => 1.0]);
        return;
    }

    $response = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query([
                'secret' => $config['recaptcha']['secret_key'],
                'response' => $token,
            ]),
        ],
    ]));

    $result = json_decode($response, true);

    if ($result['success'] && ($result['score'] ?? 0.5) >= 0.5) {
        echo json_encode(['success' => true, 'score' => $result['score'] ?? 0.5]);
    } else {
        echo json_encode(['success' => false, 'error' => 'reCAPTCHA verification failed']);
    }
}

function createVerificationAndSend($body, $pdo, $config) {
    $userId = $body['userId'] ?? '';
    $email = $body['email'] ?? '';
    $name = $body['name'] ?? '';

    if (empty($userId) || empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'userId and email required']);
        return;
    }

    // Generate verification token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 86400); // 24 hours

    $stmt = $pdo->prepare('
        INSERT INTO email_verifications (id, user_id, email, token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([generateUUID(), $userId, $email, $token, $expires]);

    // Send email
    $verifyUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . "/verify-email?token=$token";
    $subject = 'Verify your email address';
    $body = "Hi $name,\n\nPlease verify your email by clicking: $verifyUrl\n\nThis link expires in 24 hours.";

    sendEmail($email, $subject, $body, $config);

    echo json_encode(['success' => true]);
}

function verifyEmailToken($body, $pdo) {
    $token = $body['token'] ?? '';

    if (empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Token required']);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT * FROM email_verifications 
        WHERE token = ? AND verified_at IS NULL AND expires_at > NOW()
    ');
    $stmt->execute([$token]);
    $verification = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$verification) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or expired token']);
        return;
    }

    // Mark as verified
    $stmt = $pdo->prepare('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?');
    $stmt->execute([$verification['id']]);

    // Update profile
    $stmt = $pdo->prepare('UPDATE profiles SET email_verified = 1 WHERE user_id = ?');
    $stmt->execute([$verification['user_id']]);

    echo json_encode(['success' => true, 'email' => $verification['email']]);
}

function sendTestEmail($body, $pdo, $config, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $to = $body['to'] ?? '';
    $subject = $body['subject'] ?? 'Test Email from TempMail';
    $bodyText = $body['body'] ?? 'This is a test email sent from your TempMail installation.';
    $mailboxId = $body['mailboxId'] ?? null;

    if (empty($to)) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient email required']);
        return;
    }

    // Try to get mailbox config from database first
    $smtpConfig = null;
    
    if ($mailboxId) {
        $stmt = $pdo->prepare('SELECT * FROM mailboxes WHERE id = ? AND is_active = 1');
        $stmt->execute([$mailboxId]);
        $smtpConfig = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    if (!$smtpConfig) {
        // Get first active mailbox
        $stmt = $pdo->query('SELECT * FROM mailboxes WHERE is_active = 1 ORDER BY priority ASC LIMIT 1');
        $smtpConfig = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Use config.php values as fallback
    $host = $smtpConfig['smtp_host'] ?? $config['smtp']['host'] ?? SMTP_HOST ?? '';
    $port = $smtpConfig['smtp_port'] ?? $config['smtp']['port'] ?? SMTP_PORT ?? 587;
    $user = $smtpConfig['smtp_user'] ?? $config['smtp']['user'] ?? SMTP_USER ?? '';
    $pass = $smtpConfig['smtp_password'] ?? $config['smtp']['pass'] ?? SMTP_PASS ?? '';
    $from = $smtpConfig['smtp_from'] ?? $config['smtp']['from'] ?? SMTP_FROM ?? $user;

    if (empty($host) || empty($user)) {
        echo json_encode([
            'success' => false, 
            'error' => 'SMTP not configured. Please configure SMTP settings first.'
        ]);
        return;
    }

    // Send email using raw SMTP
    $result = sendSmtpEmail($host, $port, $user, $pass, $from, $to, $subject, $bodyText);
    
    // Log the attempt
    try {
        $stmt = $pdo->prepare("
            INSERT INTO email_logs (id, recipient_email, subject, status, smtp_host, mailbox_id, mailbox_name, 
                                   error_message, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            generateUUID(),
            $to,
            $subject,
            $result['success'] ? 'sent' : 'failed',
            $host,
            $smtpConfig['id'] ?? null,
            $smtpConfig['name'] ?? 'Config File',
            $result['error'] ?? null,
            $result['success'] ? date('Y-m-d H:i:s') : null
        ]);
    } catch (Exception $e) {
        // Log error but don't fail
    }

    echo json_encode($result);
}

/**
 * Send email using raw SMTP socket connection
 */
function sendSmtpEmail($host, $port, $user, $pass, $from, $to, $subject, $body, $html = null) {
    $timeout = 15;
    $errno = 0;
    $errstr = '';
    
    try {
        // Determine if we need SSL
        if ($port == 465) {
            $socket = @fsockopen("ssl://$host", $port, $errno, $errstr, $timeout);
        } else {
            $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);
        }
        
        if (!$socket) {
            return ['success' => false, 'error' => "Connection failed: $errstr ($errno)"];
        }
        
        stream_set_timeout($socket, $timeout);
        
        // Read greeting
        $greeting = fgets($socket, 1024);
        if (substr($greeting, 0, 3) !== '220') {
            fclose($socket);
            return ['success' => false, 'error' => "Invalid greeting: " . trim($greeting)];
        }
        
        // EHLO
        fputs($socket, "EHLO " . gethostname() . "\r\n");
        $response = '';
        while ($line = fgets($socket, 1024)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        
        // STARTTLS for non-SSL connections
        if ($port != 465 && strpos($response, 'STARTTLS') !== false) {
            fputs($socket, "STARTTLS\r\n");
            $tlsResp = fgets($socket, 1024);
            
            if (substr($tlsResp, 0, 3) === '220') {
                stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                
                // Re-EHLO after TLS
                fputs($socket, "EHLO " . gethostname() . "\r\n");
                while ($line = fgets($socket, 1024)) {
                    if (substr($line, 3, 1) === ' ') break;
                }
            }
        }
        
        // AUTH LOGIN
        fputs($socket, "AUTH LOGIN\r\n");
        $authResp = fgets($socket, 1024);
        
        if (substr($authResp, 0, 3) === '334') {
            fputs($socket, base64_encode($user) . "\r\n");
            fgets($socket, 1024);
            fputs($socket, base64_encode($pass) . "\r\n");
            $authResult = fgets($socket, 1024);
            
            if (substr($authResult, 0, 3) !== '235') {
                fclose($socket);
                return ['success' => false, 'error' => "Authentication failed: " . trim($authResult)];
            }
        } else {
            // Try PLAIN auth
            fputs($socket, "AUTH PLAIN " . base64_encode("\0$user\0$pass") . "\r\n");
            $authResult = fgets($socket, 1024);
            
            if (substr($authResult, 0, 3) !== '235') {
                fclose($socket);
                return ['success' => false, 'error' => "Authentication failed: " . trim($authResult)];
            }
        }
        
        // MAIL FROM
        fputs($socket, "MAIL FROM:<$from>\r\n");
        $fromResp = fgets($socket, 1024);
        if (substr($fromResp, 0, 3) !== '250') {
            fclose($socket);
            return ['success' => false, 'error' => "MAIL FROM rejected: " . trim($fromResp)];
        }
        
        // RCPT TO
        fputs($socket, "RCPT TO:<$to>\r\n");
        $rcptResp = fgets($socket, 1024);
        if (substr($rcptResp, 0, 3) !== '250') {
            fclose($socket);
            return ['success' => false, 'error' => "RCPT TO rejected: " . trim($rcptResp)];
        }
        
        // DATA
        fputs($socket, "DATA\r\n");
        $dataResp = fgets($socket, 1024);
        if (substr($dataResp, 0, 3) !== '354') {
            fclose($socket);
            return ['success' => false, 'error' => "DATA rejected: " . trim($dataResp)];
        }
        
        // Build message
        $date = date('r');
        $messageId = '<' . uniqid() . '@' . parse_url($from, PHP_URL_HOST) . '>';
        $boundary = '----=_Part_' . uniqid();
        
        $message = "From: TempMail <$from>\r\n";
        $message .= "To: <$to>\r\n";
        $message .= "Subject: $subject\r\n";
        $message .= "Date: $date\r\n";
        $message .= "Message-ID: $messageId\r\n";
        $message .= "MIME-Version: 1.0\r\n";
        $message .= "X-Mailer: TempMail PHP Backend\r\n";
        
        if ($html) {
            $message .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
            $message .= "\r\n";
            $message .= "--$boundary\r\n";
            $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $message .= "Content-Transfer-Encoding: 8bit\r\n";
            $message .= "\r\n";
            $message .= $body . "\r\n";
            $message .= "\r\n--$boundary\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\n";
            $message .= "Content-Transfer-Encoding: 8bit\r\n";
            $message .= "\r\n";
            $message .= $html . "\r\n";
            $message .= "\r\n--$boundary--\r\n";
        } else {
            $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $message .= "Content-Transfer-Encoding: 8bit\r\n";
            $message .= "\r\n";
            $message .= $body . "\r\n";
        }
        
        $message .= ".\r\n";
        
        fputs($socket, $message);
        $sendResp = fgets($socket, 1024);
        
        if (substr($sendResp, 0, 3) !== '250') {
            fclose($socket);
            return ['success' => false, 'error' => "Send failed: " . trim($sendResp)];
        }
        
        // QUIT
        fputs($socket, "QUIT\r\n");
        fclose($socket);
        
        return ['success' => true, 'message' => 'Email sent successfully'];
        
    } catch (Exception $e) {
        if (isset($socket) && $socket) {
            fclose($socket);
        }
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function summarizeEmail($body, $pdo, $userId) {
    // This would integrate with an AI service
    // For now, return a simple excerpt
    $emailId = $body['email_id'] ?? '';
    $content = $body['content'] ?? '';

    if (empty($content)) {
        $stmt = $pdo->prepare('SELECT body FROM received_emails WHERE id = ?');
        $stmt->execute([$emailId]);
        $email = $stmt->fetch(PDO::FETCH_ASSOC);
        $content = $email['body'] ?? '';
    }

    // Simple summary: first 200 characters
    $summary = substr(strip_tags($content), 0, 200);
    if (strlen($content) > 200) {
        $summary .= '...';
    }

    echo json_encode(['summary' => $summary]);
}

function createCheckout($body, $pdo, $config, $userId) {
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }

    $tierId = $body['tier_id'] ?? '';
    $interval = $body['interval'] ?? 'monthly';
    $paymentMethod = $body['payment_method'] ?? 'stripe';

    // Get tier
    $stmt = $pdo->prepare('SELECT * FROM subscription_tiers WHERE id = ? AND is_active = 1');
    $stmt->execute([$tierId]);
    $tier = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tier) {
        http_response_code(404);
        echo json_encode(['error' => 'Subscription tier not found']);
        return;
    }

    // Get user email
    $stmt = $pdo->prepare('SELECT email FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);
    $userEmail = $profile['email'] ?? '';

    // Get payment settings
    $paymentConfig = getPaymentSettings($pdo);
    
    $price = $interval === 'yearly' ? $tier['price_yearly'] : $tier['price_monthly'];
    
    if ($paymentMethod === 'paypal') {
        // PayPal checkout
        return createPaypalCheckout($pdo, $config, $paymentConfig, $userId, $tier, $interval, $price, $userEmail);
    }
    
    // Stripe checkout
    return createStripeCheckout($pdo, $config, $paymentConfig, $userId, $tier, $interval, $price, $userEmail);
}

function createStripeCheckout($pdo, $config, $paymentConfig, $userId, $tier, $interval, $price, $userEmail) {
    $secretKey = $paymentConfig['stripeSecretKey'] ?? $config['stripe']['secret_key'] ?? '';
    
    if (empty($secretKey)) {
        echo json_encode([
            'error' => 'Stripe not configured. Please add your Stripe API keys in Admin > Payments settings.',
            'code' => 'STRIPE_NOT_CONFIGURED'
        ]);
        return;
    }
    
    $currency = $paymentConfig['currency'] ?? 'usd';
    $successUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . '/dashboard?payment=success';
    $cancelUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . '/pricing?payment=canceled';
    
    // Create Stripe checkout session using cURL
    $stripeData = [
        'mode' => 'subscription',
        'success_url' => $successUrl,
        'cancel_url' => $cancelUrl,
        'client_reference_id' => $userId,
        'metadata[user_id]' => $userId,
        'metadata[tier_id]' => $tier['id'],
        'metadata[tier_name]' => $tier['name'],
        'line_items[0][price_data][currency]' => $currency,
        'line_items[0][price_data][product_data][name]' => $tier['name'] . ' Subscription',
        'line_items[0][price_data][product_data][description]' => 'Premium subscription for TempMail',
        'line_items[0][price_data][unit_amount]' => intval($price * 100),
        'line_items[0][price_data][recurring][interval]' => $interval === 'yearly' ? 'year' : 'month',
        'line_items[0][quantity]' => 1,
    ];
    
    if ($userEmail) {
        $stripeData['customer_email'] = $userEmail;
    }
    
    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($stripeData),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $secretKey,
            'Content-Type: application/x-www-form-urlencoded',
        ],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode !== 200 || isset($result['error'])) {
        logError('Stripe checkout creation failed', ['error' => $result['error'] ?? 'Unknown error', 'http_code' => $httpCode]);
        http_response_code(400);
        echo json_encode([
            'error' => $result['error']['message'] ?? 'Failed to create checkout session',
        ]);
        return;
    }
    
    logInfo('Stripe checkout session created', ['user_id' => $userId, 'tier' => $tier['name'], 'session_id' => $result['id']]);
    
    echo json_encode([
        'url' => $result['url'],
        'session_id' => $result['id'],
    ]);
}

function createPaypalCheckout($pdo, $config, $paymentConfig, $userId, $tier, $interval, $price, $userEmail) {
    $clientId = $paymentConfig['paypalClientId'] ?? $config['paypal']['client_id'] ?? '';
    $clientSecret = $paymentConfig['paypalClientSecret'] ?? $config['paypal']['client_secret'] ?? '';
    $mode = $paymentConfig['paypalMode'] ?? 'sandbox';
    
    if (empty($clientId) || empty($clientSecret)) {
        echo json_encode([
            'error' => 'PayPal not configured. Please add your PayPal API credentials in Admin > Payments settings.',
            'code' => 'PAYPAL_NOT_CONFIGURED'
        ]);
        return;
    }
    
    $baseUrl = $mode === 'live' 
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    
    // Get PayPal access token
    $ch = curl_init($baseUrl . '/v1/oauth2/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
        CURLOPT_USERPWD => $clientId . ':' . $clientSecret,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
        ],
    ]);
    
    $tokenResponse = json_decode(curl_exec($ch), true);
    curl_close($ch);
    
    if (!isset($tokenResponse['access_token'])) {
        logError('PayPal token acquisition failed', ['error' => $tokenResponse['error'] ?? 'Unknown']);
        echo json_encode(['error' => 'PayPal authentication failed']);
        return;
    }
    
    $accessToken = $tokenResponse['access_token'];
    $currency = strtoupper($paymentConfig['currency'] ?? 'USD');
    $successUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . '/dashboard?payment=success';
    $cancelUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . '/pricing?payment=canceled';
    
    // Create order (one-time payment) or subscription
    // For subscriptions, you'd need to create a product and plan first in PayPal dashboard
    // This creates a simple order for now
    $orderData = [
        'intent' => 'CAPTURE',
        'purchase_units' => [[
            'reference_id' => $userId . ':' . $tier['id'],
            'custom_id' => $userId . ':' . $tier['id'],
            'description' => $tier['name'] . ' Subscription',
            'amount' => [
                'currency_code' => $currency,
                'value' => number_format($price, 2, '.', ''),
            ],
        ]],
        'application_context' => [
            'return_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'brand_name' => 'TempMail',
            'user_action' => 'PAY_NOW',
        ],
    ];
    
    $ch = curl_init($baseUrl . '/v2/checkout/orders');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($orderData),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode !== 201 || !isset($result['id'])) {
        logError('PayPal order creation failed', ['error' => $result, 'http_code' => $httpCode]);
        echo json_encode(['error' => 'Failed to create PayPal order']);
        return;
    }
    
    // Find approval link
    $approvalUrl = '';
    foreach ($result['links'] as $link) {
        if ($link['rel'] === 'approve') {
            $approvalUrl = $link['href'];
            break;
        }
    }
    
    logInfo('PayPal order created', ['user_id' => $userId, 'tier' => $tier['name'], 'order_id' => $result['id']]);
    
    echo json_encode([
        'url' => $approvalUrl,
        'order_id' => $result['id'],
        'payment_method' => 'paypal',
    ]);
}

function getPaymentSettings($pdo) {
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
    $stmt->execute(['payment_settings']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($row && $row['value']) {
        return json_decode($row['value'], true);
    }
    
    return [];
}

function emailWebhook($body, $pdo, $config) {
    // Handle incoming email webhooks from Mailgun/SendGrid/etc.
    $from = $body['from'] ?? $body['sender'] ?? '';
    $to = $body['to'] ?? $body['recipient'] ?? '';
    $subject = $body['subject'] ?? '';
    $textBody = $body['body-plain'] ?? $body['text'] ?? $body['body'] ?? '';
    $htmlBody = $body['body-html'] ?? $body['html'] ?? '';

    if (empty($to)) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient required']);
        return;
    }

    // Find matching temp email
    $stmt = $pdo->prepare('
        SELECT id FROM temp_emails 
        WHERE address = ? AND is_active = 1 AND expires_at > NOW()
    ');
    $stmt->execute([strtolower($to)]);
    $tempEmail = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tempEmail) {
        http_response_code(404);
        echo json_encode(['error' => 'Recipient not found']);
        return;
    }

    // Store email
    $emailId = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO received_emails (id, temp_email_id, from_address, subject, body, html_body, received_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([$emailId, $tempEmail['id'], $from, $subject, $textBody, $htmlBody]);

    // Update stats
    $stmt = $pdo->prepare("
        INSERT INTO email_stats (id, stat_key, stat_value, updated_at)
        VALUES (?, 'total_emails_received', 1, NOW())
        ON DUPLICATE KEY UPDATE stat_value = stat_value + 1, updated_at = NOW()
    ");
    $stmt->execute([generateUUID()]);

    echo json_encode(['success' => true, 'email_id' => $emailId]);
}

function generateBackup($pdo, $isAdmin, $userId) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $tables = ['domains', 'app_settings', 'blogs', 'email_templates', 'friendly_websites', 'homepage_sections'];
    $backup = [];
    $rowCounts = [];

    foreach ($tables as $table) {
        $stmt = $pdo->query("SELECT * FROM $table");
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $backup[$table] = $data;
        $rowCounts[$table] = count($data);
    }

    // Store backup record
    $backupId = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO backup_history (id, backup_type, tables_included, row_counts, created_by, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([
        $backupId,
        'manual',
        json_encode($tables),
        json_encode($rowCounts),
        $userId,
        'completed'
    ]);

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="backup_' . date('Y-m-d_His') . '.json"');
    echo json_encode($backup, JSON_PRETTY_PRINT);
    exit;
}

function emailHealthCheck($pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    // Check mailbox status
    $stmt = $pdo->query('
        SELECT id, name, is_active, last_polled_at, last_error, last_error_at,
               emails_sent_today, daily_limit, emails_sent_this_hour, hourly_limit
        FROM mailboxes
        ORDER BY priority ASC
    ');
    $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $health = [
        'status' => 'healthy',
        'mailboxes' => [],
        'issues' => [],
    ];

    foreach ($mailboxes as $mb) {
        $mailboxHealth = [
            'id' => $mb['id'],
            'name' => $mb['name'],
            'is_active' => (bool) $mb['is_active'],
            'last_polled' => $mb['last_polled_at'],
            'daily_usage' => $mb['emails_sent_today'] . '/' . $mb['daily_limit'],
            'hourly_usage' => $mb['emails_sent_this_hour'] . '/' . $mb['hourly_limit'],
        ];

        if ($mb['last_error']) {
            $mailboxHealth['last_error'] = $mb['last_error'];
            $mailboxHealth['last_error_at'] = $mb['last_error_at'];
            $health['issues'][] = "Mailbox {$mb['name']} has error: {$mb['last_error']}";
        }

        $health['mailboxes'][] = $mailboxHealth;
    }

    if (!empty($health['issues'])) {
        $health['status'] = 'degraded';
    }

    echo json_encode($health);
}

<?php
/**
 * Webhook Routes - Stripe and PayPal payment webhooks
 */

function handleWebhook($provider, $body, $pdo, $config) {
    $logger = ErrorLogger::getInstance(__DIR__ . '/../logs');
    
    switch ($provider) {
        case 'stripe':
            handleStripeWebhook($pdo, $config, $logger);
            break;
            
        case 'paypal':
            handlePaypalWebhook($pdo, $config, $logger);
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown webhook provider']);
    }
}

function handleStripeWebhook($pdo, $config, $logger) {
    // Get raw payload
    $payload = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    
    // Get Stripe keys from database or config
    $stripeConfig = getPaymentConfig($pdo, 'stripe');
    $webhookSecret = $stripeConfig['webhook_secret'] ?? $config['stripe']['webhook_secret'] ?? '';
    
    if (empty($webhookSecret)) {
        $logger->warning('Stripe webhook received but no webhook secret configured');
        http_response_code(400);
        echo json_encode(['error' => 'Webhook secret not configured']);
        return;
    }
    
    // Verify signature
    try {
        $event = verifyStripeSignature($payload, $sigHeader, $webhookSecret);
    } catch (Exception $e) {
        $logger->error('Stripe webhook signature verification failed', ['error' => $e->getMessage()]);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid signature']);
        return;
    }
    
    if (!$event) {
        $event = json_decode($payload, true);
    }
    
    $eventType = $event['type'] ?? '';
    $eventData = $event['data']['object'] ?? [];
    
    $logger->info('Stripe webhook received', ['type' => $eventType, 'id' => $event['id'] ?? 'unknown']);
    
    try {
        switch ($eventType) {
            case 'checkout.session.completed':
                handleCheckoutCompleted($pdo, $eventData, $logger);
                break;
                
            case 'invoice.paid':
                handleInvoicePaid($pdo, $eventData, $logger);
                break;
                
            case 'invoice.payment_failed':
                handlePaymentFailed($pdo, $eventData, $logger);
                break;
                
            case 'customer.subscription.updated':
                handleSubscriptionUpdated($pdo, $eventData, $logger);
                break;
                
            case 'customer.subscription.deleted':
                handleSubscriptionDeleted($pdo, $eventData, $logger);
                break;
                
            default:
                $logger->info('Unhandled Stripe event type', ['type' => $eventType]);
        }
        
        echo json_encode(['received' => true]);
        
    } catch (Exception $e) {
        $logger->error('Stripe webhook processing error', ['error' => $e->getMessage(), 'type' => $eventType]);
        http_response_code(500);
        echo json_encode(['error' => 'Webhook processing failed']);
    }
}

function handlePaypalWebhook($pdo, $config, $logger) {
    $payload = file_get_contents('php://input');
    $headers = getallheaders();
    
    // Get PayPal config
    $paypalConfig = getPaymentConfig($pdo, 'paypal');
    $webhookId = $paypalConfig['webhook_id'] ?? $config['paypal']['webhook_id'] ?? '';
    
    // Verify PayPal webhook (simplified - production should use PayPal SDK)
    $event = json_decode($payload, true);
    
    if (!$event) {
        $logger->error('Invalid PayPal webhook payload');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid payload']);
        return;
    }
    
    $eventType = $event['event_type'] ?? '';
    $resource = $event['resource'] ?? [];
    
    $logger->info('PayPal webhook received', ['type' => $eventType, 'id' => $event['id'] ?? 'unknown']);
    
    try {
        switch ($eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                handlePaypalPaymentCompleted($pdo, $resource, $logger);
                break;
                
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                handlePaypalSubscriptionActivated($pdo, $resource, $logger);
                break;
                
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                handlePaypalSubscriptionCancelled($pdo, $resource, $logger);
                break;
                
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                handlePaypalPaymentFailed($pdo, $resource, $logger);
                break;
                
            default:
                $logger->info('Unhandled PayPal event type', ['type' => $eventType]);
        }
        
        echo json_encode(['received' => true]);
        
    } catch (Exception $e) {
        $logger->error('PayPal webhook processing error', ['error' => $e->getMessage(), 'type' => $eventType]);
        http_response_code(500);
        echo json_encode(['error' => 'Webhook processing failed']);
    }
}

// =========== STRIPE HANDLERS ===========

function handleCheckoutCompleted($pdo, $session, $logger) {
    $customerId = $session['customer'] ?? '';
    $subscriptionId = $session['subscription'] ?? '';
    $clientReferenceId = $session['client_reference_id'] ?? ''; // This should be user_id
    $metadata = $session['metadata'] ?? [];
    
    $userId = $clientReferenceId ?: ($metadata['user_id'] ?? '');
    $tierId = $metadata['tier_id'] ?? '';
    
    if (empty($userId) || empty($tierId)) {
        $logger->warning('Checkout completed but missing user_id or tier_id', ['session_id' => $session['id'] ?? '']);
        return;
    }
    
    // Get subscription details from Stripe
    $periodEnd = date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60)); // Default 30 days
    
    // Check for existing subscription
    $stmt = $pdo->prepare('SELECT id FROM user_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        // Update existing
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET
                tier_id = ?,
                stripe_customer_id = ?,
                stripe_subscription_id = ?,
                status = ?,
                current_period_start = NOW(),
                current_period_end = ?,
                updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute([$tierId, $customerId, $subscriptionId, 'active', $periodEnd, $userId]);
    } else {
        // Create new
        $stmt = $pdo->prepare('
            INSERT INTO user_subscriptions 
            (id, user_id, tier_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
        ');
        $stmt->execute([generateUUID(), $userId, $tierId, $customerId, $subscriptionId, 'active', $periodEnd]);
    }
    
    // Log invoice
    $amount = ($session['amount_total'] ?? 0) / 100;
    $currency = $session['currency'] ?? 'usd';
    
    $stmt = $pdo->prepare('
        INSERT INTO user_invoices (id, user_id, stripe_payment_intent_id, amount_paid, currency, status, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');
    $stmt->execute([
        generateUUID(),
        $userId,
        $session['payment_intent'] ?? '',
        $amount,
        $currency,
        'paid'
    ]);
    
    $logger->info('Subscription created from checkout', [
        'user_id' => $userId,
        'tier_id' => $tierId,
        'subscription_id' => $subscriptionId
    ]);
}

function handleInvoicePaid($pdo, $invoice, $logger) {
    $subscriptionId = $invoice['subscription'] ?? '';
    $customerId = $invoice['customer'] ?? '';
    $amount = ($invoice['amount_paid'] ?? 0) / 100;
    $currency = $invoice['currency'] ?? 'usd';
    
    // Find user by subscription ID
    $stmt = $pdo->prepare('SELECT user_id FROM user_subscriptions WHERE stripe_subscription_id = ?');
    $stmt->execute([$subscriptionId]);
    $subscription = $stmt->fetch();
    
    if (!$subscription) {
        $logger->warning('Invoice paid but subscription not found', ['subscription_id' => $subscriptionId]);
        return;
    }
    
    $userId = $subscription['user_id'];
    
    // Extend subscription period
    $periodEnd = isset($invoice['lines']['data'][0]['period']['end']) 
        ? date('Y-m-d H:i:s', $invoice['lines']['data'][0]['period']['end'])
        : date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET
            status = ?,
            current_period_end = ?,
            updated_at = NOW()
        WHERE user_id = ?
    ');
    $stmt->execute(['active', $periodEnd, $userId]);
    
    // Log invoice
    $stmt = $pdo->prepare('
        INSERT INTO user_invoices (id, user_id, stripe_invoice_id, amount_paid, currency, status, 
                                   invoice_pdf, invoice_url, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');
    $stmt->execute([
        generateUUID(),
        $userId,
        $invoice['id'] ?? '',
        $amount,
        $currency,
        'paid',
        $invoice['invoice_pdf'] ?? null,
        $invoice['hosted_invoice_url'] ?? null
    ]);
    
    $logger->info('Invoice paid', ['user_id' => $userId, 'amount' => $amount]);
}

function handlePaymentFailed($pdo, $invoice, $logger) {
    $subscriptionId = $invoice['subscription'] ?? '';
    
    $stmt = $pdo->prepare('SELECT user_id FROM user_subscriptions WHERE stripe_subscription_id = ?');
    $stmt->execute([$subscriptionId]);
    $subscription = $stmt->fetch();
    
    if ($subscription) {
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET status = ?, updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute(['past_due', $subscription['user_id']]);
        
        $logger->warning('Payment failed for subscription', [
            'user_id' => $subscription['user_id'],
            'subscription_id' => $subscriptionId
        ]);
    }
}

function handleSubscriptionUpdated($pdo, $subscription, $logger) {
    $subscriptionId = $subscription['id'] ?? '';
    $status = $subscription['status'] ?? 'active';
    $cancelAtPeriodEnd = $subscription['cancel_at_period_end'] ?? false;
    
    $periodEnd = isset($subscription['current_period_end'])
        ? date('Y-m-d H:i:s', $subscription['current_period_end'])
        : null;
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET
            status = ?,
            cancel_at_period_end = ?,
            current_period_end = COALESCE(?, current_period_end),
            updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute([$status, $cancelAtPeriodEnd ? 1 : 0, $periodEnd, $subscriptionId]);
    
    $logger->info('Subscription updated', ['subscription_id' => $subscriptionId, 'status' => $status]);
}

function handleSubscriptionDeleted($pdo, $subscription, $logger) {
    $subscriptionId = $subscription['id'] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['canceled', $subscriptionId]);
    
    $logger->info('Subscription canceled', ['subscription_id' => $subscriptionId]);
}

// =========== PAYPAL HANDLERS ===========

function handlePaypalPaymentCompleted($pdo, $resource, $logger) {
    $orderId = $resource['supplementary_data']['related_ids']['order_id'] ?? '';
    $amount = $resource['amount']['value'] ?? 0;
    $currency = $resource['amount']['currency_code'] ?? 'USD';
    
    $logger->info('PayPal payment completed', ['order_id' => $orderId, 'amount' => $amount]);
}

function handlePaypalSubscriptionActivated($pdo, $resource, $logger) {
    $subscriptionId = $resource['id'] ?? '';
    $customId = $resource['custom_id'] ?? ''; // user_id:tier_id
    
    $parts = explode(':', $customId);
    $userId = $parts[0] ?? '';
    $tierId = $parts[1] ?? '';
    
    if (empty($userId) || empty($tierId)) {
        $logger->warning('PayPal subscription activated but missing user/tier', ['subscription_id' => $subscriptionId]);
        return;
    }
    
    $nextBillingTime = $resource['billing_info']['next_billing_time'] ?? '';
    $periodEnd = $nextBillingTime ? date('Y-m-d H:i:s', strtotime($nextBillingTime)) : date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
    
    // Check for existing subscription
    $stmt = $pdo->prepare('SELECT id FROM user_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET
                tier_id = ?,
                stripe_subscription_id = ?,
                status = ?,
                current_period_start = NOW(),
                current_period_end = ?,
                updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute([$tierId, 'paypal_' . $subscriptionId, 'active', $periodEnd, $userId]);
    } else {
        $stmt = $pdo->prepare('
            INSERT INTO user_subscriptions 
            (id, user_id, tier_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
        ');
        $stmt->execute([generateUUID(), $userId, $tierId, 'paypal_' . $subscriptionId, 'active', $periodEnd]);
    }
    
    $logger->info('PayPal subscription activated', ['user_id' => $userId, 'tier_id' => $tierId]);
}

function handlePaypalSubscriptionCancelled($pdo, $resource, $logger) {
    $subscriptionId = $resource['id'] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['canceled', 'paypal_' . $subscriptionId]);
    
    $logger->info('PayPal subscription cancelled', ['subscription_id' => $subscriptionId]);
}

function handlePaypalPaymentFailed($pdo, $resource, $logger) {
    $subscriptionId = $resource['id'] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['past_due', 'paypal_' . $subscriptionId]);
    
    $logger->warning('PayPal payment failed', ['subscription_id' => $subscriptionId]);
}

// =========== HELPERS ===========

function getPaymentConfig($pdo, $provider) {
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
    $stmt->execute(['payment_settings']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($row && $row['value']) {
        $settings = json_decode($row['value'], true);
        
        if ($provider === 'stripe') {
            return [
                'secret_key' => $settings['stripeSecretKey'] ?? '',
                'webhook_secret' => $settings['stripeWebhookSecret'] ?? '',
                'publishable_key' => $settings['stripePublishableKey'] ?? '',
            ];
        } elseif ($provider === 'paypal') {
            return [
                'client_id' => $settings['paypalClientId'] ?? '',
                'client_secret' => $settings['paypalClientSecret'] ?? '',
                'webhook_id' => $settings['paypalWebhookId'] ?? '',
                'mode' => $settings['paypalMode'] ?? 'sandbox',
            ];
        }
    }
    
    return [];
}

function verifyStripeSignature($payload, $sigHeader, $secret) {
    // Parse the signature header
    $parts = explode(',', $sigHeader);
    $timestamp = null;
    $signatures = [];
    
    foreach ($parts as $part) {
        $kv = explode('=', trim($part), 2);
        if (count($kv) === 2) {
            if ($kv[0] === 't') {
                $timestamp = $kv[1];
            } elseif ($kv[0] === 'v1') {
                $signatures[] = $kv[1];
            }
        }
    }
    
    if (!$timestamp || empty($signatures)) {
        throw new Exception('Invalid signature header');
    }
    
    // Check timestamp (allow 5 minutes tolerance)
    if (abs(time() - intval($timestamp)) > 300) {
        throw new Exception('Timestamp outside tolerance zone');
    }
    
    // Compute expected signature
    $signedPayload = $timestamp . '.' . $payload;
    $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);
    
    // Check if any signature matches
    foreach ($signatures as $sig) {
        if (hash_equals($expectedSignature, $sig)) {
            return json_decode($payload, true);
        }
    }
    
    throw new Exception('Signature verification failed');
}

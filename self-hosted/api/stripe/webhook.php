<?php
/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';

// Don't use Response::setCorsHeaders() - Stripe sends webhooks directly
header('Content-Type: application/json');

$config = Database::getConfig();

if (!($config['stripe']['enabled'] ?? false)) {
    http_response_code(503);
    echo json_encode(['error' => 'Payments not enabled']);
    exit;
}

$webhookSecret = $config['stripe']['webhook_secret'];
$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

// Verify webhook signature
if (!empty($webhookSecret) && !empty($sigHeader)) {
    $elements = explode(',', $sigHeader);
    $timestamp = null;
    $signatures = [];
    
    foreach ($elements as $element) {
        $parts = explode('=', $element, 2);
        if (count($parts) === 2) {
            if ($parts[0] === 't') {
                $timestamp = $parts[1];
            } elseif ($parts[0] === 'v1') {
                $signatures[] = $parts[1];
            }
        }
    }
    
    if ($timestamp && !empty($signatures)) {
        $signedPayload = $timestamp . '.' . $payload;
        $expectedSig = hash_hmac('sha256', $signedPayload, $webhookSecret);
        
        $valid = false;
        foreach ($signatures as $sig) {
            if (hash_equals($expectedSig, $sig)) {
                $valid = true;
                break;
            }
        }
        
        if (!$valid) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signature']);
            exit;
        }
    }
}

$event = json_decode($payload, true);

if (!$event || !isset($event['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

try {
    switch ($event['type']) {
        case 'checkout.session.completed':
            $session = $event['data']['object'];
            handleCheckoutCompleted($session);
            break;
            
        case 'invoice.paid':
            $invoice = $event['data']['object'];
            handleInvoicePaid($invoice);
            break;
            
        case 'invoice.payment_failed':
            $invoice = $event['data']['object'];
            handlePaymentFailed($invoice);
            break;
            
        case 'customer.subscription.updated':
            $subscription = $event['data']['object'];
            handleSubscriptionUpdated($subscription);
            break;
            
        case 'customer.subscription.deleted':
            $subscription = $event['data']['object'];
            handleSubscriptionCanceled($subscription);
            break;
            
        default:
            // Log unhandled events
            error_log("Unhandled Stripe event: " . $event['type']);
    }
    
    echo json_encode(['received' => true]);
    
} catch (Exception $e) {
    error_log("Stripe webhook error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Webhook processing failed']);
}

function handleCheckoutCompleted(array $session): void {
    $userId = $session['metadata']['user_id'] ?? null;
    $tierId = $session['metadata']['tier_id'] ?? null;
    
    if (!$userId || !$tierId) {
        error_log("Missing metadata in checkout session");
        return;
    }
    
    $subscriptionId = $session['subscription'] ?? null;
    $customerId = $session['customer'] ?? null;
    
    // Update or create subscription
    $existing = Database::fetchOne(
        "SELECT id FROM user_subscriptions WHERE user_id = ?",
        [$userId]
    );
    
    if ($existing) {
        Database::update(
            'user_subscriptions',
            [
                'tier_id' => $tierId,
                'stripe_subscription_id' => $subscriptionId,
                'stripe_customer_id' => $customerId,
                'status' => 'active',
                'current_period_start' => date('Y-m-d H:i:s'),
                'current_period_end' => date('Y-m-d H:i:s', strtotime('+1 month')),
                'updated_at' => date('Y-m-d H:i:s')
            ],
            'id = ?',
            [$existing['id']]
        );
    } else {
        Database::insert('user_subscriptions', [
            'id' => Database::generateUUID(),
            'user_id' => $userId,
            'tier_id' => $tierId,
            'stripe_subscription_id' => $subscriptionId,
            'stripe_customer_id' => $customerId,
            'status' => 'active',
            'current_period_start' => date('Y-m-d H:i:s'),
            'current_period_end' => date('Y-m-d H:i:s', strtotime('+1 month')),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    }
    
    // Create invoice record
    Database::insert('user_invoices', [
        'id' => Database::generateUUID(),
        'user_id' => $userId,
        'stripe_invoice_id' => $session['invoice'] ?? null,
        'amount' => ($session['amount_total'] ?? 0) / 100,
        'currency' => $session['currency'] ?? 'usd',
        'status' => 'paid',
        'paid_at' => date('Y-m-d H:i:s'),
        'created_at' => date('Y-m-d H:i:s')
    ]);
}

function handleInvoicePaid(array $invoice): void {
    $subscriptionId = $invoice['subscription'] ?? null;
    
    if ($subscriptionId) {
        Database::update(
            'user_subscriptions',
            [
                'status' => 'active',
                'current_period_end' => date('Y-m-d H:i:s', $invoice['lines']['data'][0]['period']['end'] ?? strtotime('+1 month')),
                'updated_at' => date('Y-m-d H:i:s')
            ],
            'stripe_subscription_id = ?',
            [$subscriptionId]
        );
    }
}

function handlePaymentFailed(array $invoice): void {
    $subscriptionId = $invoice['subscription'] ?? null;
    
    if ($subscriptionId) {
        Database::update(
            'user_subscriptions',
            [
                'status' => 'past_due',
                'updated_at' => date('Y-m-d H:i:s')
            ],
            'stripe_subscription_id = ?',
            [$subscriptionId]
        );
    }
}

function handleSubscriptionUpdated(array $subscription): void {
    Database::update(
        'user_subscriptions',
        [
            'status' => $subscription['status'],
            'current_period_start' => date('Y-m-d H:i:s', $subscription['current_period_start']),
            'current_period_end' => date('Y-m-d H:i:s', $subscription['current_period_end']),
            'cancel_at_period_end' => $subscription['cancel_at_period_end'] ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s')
        ],
        'stripe_subscription_id = ?',
        [$subscription['id']]
    );
}

function handleSubscriptionCanceled(array $subscription): void {
    Database::update(
        'user_subscriptions',
        [
            'status' => 'canceled',
            'canceled_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ],
        'stripe_subscription_id = ?',
        [$subscription['id']]
    );
}

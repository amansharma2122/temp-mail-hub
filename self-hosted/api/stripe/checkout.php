<?php
/**
 * Stripe Checkout Session
 * POST /api/stripe/checkout.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$config = Database::getConfig();

if (!($config['stripe']['enabled'] ?? false)) {
    Response::error('Payments are not enabled', 503);
}

$user = Auth::requireAuth();
$input = Response::getJsonInput();

$tierId = $input['tier_id'] ?? '';
$successUrl = $input['success_url'] ?? '';
$cancelUrl = $input['cancel_url'] ?? '';

if (empty($tierId)) {
    Response::error('Subscription tier is required');
}

try {
    // Get tier details
    $tier = Database::fetchOne(
        "SELECT * FROM subscription_tiers WHERE id = ? AND is_active = 1",
        [$tierId]
    );
    
    if (!$tier) {
        Response::notFound('Subscription tier not found');
    }
    
    // Check for existing active subscription
    $existingSub = Database::fetchOne(
        "SELECT * FROM user_subscriptions WHERE user_id = ? AND status = 'active'",
        [$user['id']]
    );
    
    if ($existingSub) {
        Response::error('You already have an active subscription');
    }
    
    // Initialize Stripe
    $stripeSecretKey = $config['stripe']['secret_key'];
    
    // Create Stripe checkout session using cURL
    $checkoutData = [
        'mode' => $tier['billing_period'] === 'one_time' ? 'payment' : 'subscription',
        'customer_email' => $user['email'],
        'success_url' => $successUrl ?: ($config['app']['url'] . '/dashboard?payment=success'),
        'cancel_url' => $cancelUrl ?: ($config['app']['url'] . '/pricing?payment=cancelled'),
        'metadata' => [
            'user_id' => $user['id'],
            'tier_id' => $tierId
        ]
    ];
    
    // If there's a Stripe price ID, use it
    if (!empty($tier['stripe_price_id'])) {
        $checkoutData['line_items'] = [[
            'price' => $tier['stripe_price_id'],
            'quantity' => 1
        ]];
    } else {
        // Create price on the fly
        $checkoutData['line_items'] = [[
            'price_data' => [
                'currency' => strtolower($tier['currency'] ?? 'usd'),
                'product_data' => [
                    'name' => $tier['name'],
                    'description' => $tier['description'] ?? ''
                ],
                'unit_amount' => (int) ($tier['price'] * 100),
                'recurring' => $tier['billing_period'] !== 'one_time' ? [
                    'interval' => $tier['billing_period'] === 'yearly' ? 'year' : 'month'
                ] : null
            ],
            'quantity' => 1
        ]];
        
        // Remove recurring if one-time
        if ($tier['billing_period'] === 'one_time') {
            unset($checkoutData['line_items'][0]['price_data']['recurring']);
        }
    }
    
    // Call Stripe API
    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($checkoutData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $stripeSecretKey,
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $stripeResponse = json_decode($response, true);
    
    if ($httpCode !== 200 || !isset($stripeResponse['url'])) {
        error_log("Stripe checkout error: " . $response);
        Response::error('Failed to create checkout session');
    }
    
    Response::success([
        'checkout_url' => $stripeResponse['url'],
        'session_id' => $stripeResponse['id']
    ], 'Checkout session created');
    
} catch (Exception $e) {
    error_log("Stripe checkout error: " . $e->getMessage());
    Response::serverError('Payment processing failed');
}

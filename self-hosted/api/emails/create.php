<?php
/**
 * Create Temporary Email
 * POST /api/emails/create.php
 * 
 * Creates a new temporary email address with secure token
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/encryption.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$input = Response::getJsonInput();
$domainId = $input['domain_id'] ?? null;

// Check rate limit (anonymous or authenticated)
$user = Auth::getCurrentUser();
$rateLimitKey = $user ? 'create-email:' . $user['id'] : 'create-email';
$config = Database::getConfig();
$maxEmails = $config['rate_limits']['emails_per_hour'] ?? 20;

if (!Auth::checkRateLimit($rateLimitKey, $maxEmails, 60)) {
    Response::tooManyRequests('Email creation limit reached. Please try again later.');
}

try {
    // Get available domain
    if ($domainId) {
        $domain = Database::fetchOne(
            "SELECT * FROM domains WHERE id = ? AND is_active = 1",
            [$domainId]
        );
    } else {
        // Get random active domain
        $domain = Database::fetchOne(
            "SELECT * FROM domains WHERE is_active = 1 ORDER BY RAND() LIMIT 1"
        );
    }
    
    if (!$domain) {
        Response::error('No active domains available', 503);
    }
    
    // Generate unique email address
    $username = generateUsername();
    $emailAddress = $username . '@' . $domain['domain'];
    
    // Ensure uniqueness
    $attempts = 0;
    while ($attempts < 5) {
        $existing = Database::fetchOne(
            "SELECT id FROM temp_emails WHERE email = ?",
            [$emailAddress]
        );
        
        if (!$existing) {
            break;
        }
        
        $username = generateUsername();
        $emailAddress = $username . '@' . $domain['domain'];
        $attempts++;
    }
    
    if ($attempts >= 5) {
        Response::serverError('Could not generate unique email address');
    }
    
    // Generate secure access token
    $accessToken = Encryption::generateSecureToken(32);
    $tokenHash = hash('sha256', $accessToken);
    
    // Calculate expiry
    $expiryHours = $domain['default_expiry_hours'] ?? 24;
    $expiresAt = date('Y-m-d H:i:s', time() + ($expiryHours * 3600));
    
    // Create temp email record
    $emailId = Database::insert('temp_emails', [
        'id' => Database::generateUUID(),
        'user_id' => $user ? $user['id'] : null,
        'email' => $emailAddress,
        'domain_id' => $domain['id'],
        'token_hash' => $tokenHash,
        'expires_at' => $expiresAt,
        'is_active' => 1,
        'created_at' => date('Y-m-d H:i:s')
    ]);
    
    // Log creation
    Database::insert('email_stats', [
        'id' => Database::generateUUID(),
        'date' => date('Y-m-d'),
        'emails_created' => 1,
        'created_at' => date('Y-m-d H:i:s')
    ]);
    
    Response::success([
        'id' => $emailId,
        'email' => $emailAddress,
        'token' => $accessToken,
        'domain' => $domain['domain'],
        'expires_at' => $expiresAt,
        'expires_in_hours' => $expiryHours
    ], 'Temporary email created successfully', 201);
    
} catch (Exception $e) {
    error_log("Create email error: " . $e->getMessage());
    Response::serverError('Failed to create temporary email');
}

/**
 * Generate random username
 */
function generateUsername(): string {
    $adjectives = ['swift', 'clever', 'bright', 'cool', 'quick', 'smart', 'happy', 'lucky', 'rapid', 'silent'];
    $nouns = ['fox', 'wolf', 'bear', 'eagle', 'hawk', 'tiger', 'lion', 'shark', 'falcon', 'phoenix'];
    
    $adj = $adjectives[array_rand($adjectives)];
    $noun = $nouns[array_rand($nouns)];
    $num = random_int(100, 9999);
    
    return $adj . $noun . $num;
}

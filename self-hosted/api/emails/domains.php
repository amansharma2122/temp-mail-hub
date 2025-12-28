<?php
/**
 * Get Available Domains
 * GET /api/emails/domains.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('GET');

try {
    $domains = Database::fetchAll(
        "SELECT id, domain, is_premium, default_expiry_hours, created_at 
         FROM domains 
         WHERE is_active = 1 
         ORDER BY is_premium ASC, domain ASC"
    );
    
    $formattedDomains = array_map(function($domain) {
        return [
            'id' => $domain['id'],
            'domain' => $domain['domain'],
            'is_premium' => (bool) $domain['is_premium'],
            'default_expiry_hours' => (int) $domain['default_expiry_hours']
        ];
    }, $domains);
    
    Response::success([
        'domains' => $formattedDomains,
        'count' => count($formattedDomains)
    ]);
    
} catch (Exception $e) {
    error_log("Domains error: " . $e->getMessage());
    Response::serverError('Failed to fetch domains');
}

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
    // Check if domains table exists
    $tableExists = Database::fetchOne("SHOW TABLES LIKE 'domains'");
    
    if (!$tableExists) {
        Response::success([
            'domains' => [],
            'count' => 0,
            'message' => 'Domains table not found. Please run the database schema.'
        ]);
        return;
    }
    
    $domains = Database::fetchAll(
        "SELECT id, domain, display_name, is_premium, is_active, created_at 
         FROM domains 
         WHERE is_active = 1 
         ORDER BY is_premium ASC, domain ASC"
    );
    
    // Get default expiry from app_settings
    $defaultExpiry = 24;
    try {
        $expirySetting = Database::fetchOne(
            "SELECT value FROM app_settings WHERE `key` = 'default_email_expiry_hours'"
        );
        if ($expirySetting && !empty($expirySetting['value'])) {
            $defaultExpiry = (int) json_decode($expirySetting['value'], true) ?: 24;
        }
    } catch (Exception $e) {
        // Use default
    }
    
    $formattedDomains = array_map(function($domain) use ($defaultExpiry) {
        return [
            'id' => $domain['id'],
            'domain' => $domain['domain'],
            'display_name' => $domain['display_name'] ?? $domain['domain'],
            'is_premium' => (bool) $domain['is_premium'],
            'default_expiry_hours' => $defaultExpiry
        ];
    }, $domains);
    
    Response::success([
        'domains' => $formattedDomains,
        'count' => count($formattedDomains)
    ]);
    
} catch (Exception $e) {
    error_log("Domains error: " . $e->getMessage());
    Response::serverError('Failed to fetch domains: ' . $e->getMessage());
}

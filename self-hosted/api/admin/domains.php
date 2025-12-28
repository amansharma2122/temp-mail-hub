<?php
/**
 * Admin Domains Management
 * GET/POST/PUT/DELETE /api/admin/domains.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();

$user = Auth::requireAdmin();
$method = Response::getMethod();

try {
    switch ($method) {
        case 'GET':
            $domains = Database::fetchAll(
                "SELECT d.*, 
                        (SELECT COUNT(*) FROM temp_emails te WHERE te.domain_id = d.id) as email_count,
                        (SELECT COUNT(*) FROM temp_emails te WHERE te.domain_id = d.id AND te.is_active = 1) as active_count
                 FROM domains d
                 ORDER BY d.created_at DESC"
            );
            
            Response::success(['domains' => $domains]);
            break;
            
        case 'POST':
            $input = Response::getJsonInput();
            
            $missing = Response::validateRequired($input, ['domain']);
            if ($missing) {
                Response::error('Domain name is required');
            }
            
            $domain = strtolower(trim($input['domain']));
            
            // Validate domain format
            if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $domain)) {
                Response::error('Invalid domain format');
            }
            
            // Check if exists
            $existing = Database::fetchOne(
                "SELECT id FROM domains WHERE domain = ?",
                [$domain]
            );
            
            if ($existing) {
                Response::error('Domain already exists', 409);
            }
            
            $domainId = Database::insert('domains', [
                'id' => Database::generateUUID(),
                'domain' => $domain,
                'is_active' => $input['is_active'] ?? 1,
                'is_premium' => $input['is_premium'] ?? 0,
                'default_expiry_hours' => $input['default_expiry_hours'] ?? 24,
                'mx_verified' => 0,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            // Audit log
            Database::insert('admin_audit_logs', [
                'id' => Database::generateUUID(),
                'admin_id' => $user['id'],
                'action' => 'domain_created',
                'entity_type' => 'domain',
                'entity_id' => $domainId,
                'details' => json_encode(['domain' => $domain]),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            Response::success(['id' => $domainId, 'domain' => $domain], 'Domain created', 201);
            break;
            
        case 'PUT':
            $input = Response::getJsonInput();
            $domainId = $input['id'] ?? $_GET['id'] ?? '';
            
            if (empty($domainId)) {
                Response::error('Domain ID is required');
            }
            
            $existing = Database::fetchOne(
                "SELECT * FROM domains WHERE id = ?",
                [$domainId]
            );
            
            if (!$existing) {
                Response::notFound('Domain not found');
            }
            
            $updates = [];
            $allowedFields = ['is_active', 'is_premium', 'default_expiry_hours', 'mx_verified'];
            
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updates[$field] = $input[$field];
                }
            }
            
            if (!empty($updates)) {
                $updates['updated_at'] = date('Y-m-d H:i:s');
                Database::update('domains', $updates, 'id = ?', [$domainId]);
            }
            
            Response::success(null, 'Domain updated');
            break;
            
        case 'DELETE':
            $domainId = $_GET['id'] ?? '';
            
            if (empty($domainId)) {
                Response::error('Domain ID is required');
            }
            
            $existing = Database::fetchOne(
                "SELECT * FROM domains WHERE id = ?",
                [$domainId]
            );
            
            if (!$existing) {
                Response::notFound('Domain not found');
            }
            
            // Check for active emails
            $activeEmails = Database::fetchOne(
                "SELECT COUNT(*) as count FROM temp_emails WHERE domain_id = ? AND is_active = 1",
                [$domainId]
            );
            
            if ($activeEmails['count'] > 0) {
                Response::error('Cannot delete domain with active emails. Deactivate it instead.');
            }
            
            Database::delete('domains', 'id = ?', [$domainId]);
            
            // Audit log
            Database::insert('admin_audit_logs', [
                'id' => Database::generateUUID(),
                'admin_id' => $user['id'],
                'action' => 'domain_deleted',
                'entity_type' => 'domain',
                'entity_id' => $domainId,
                'details' => json_encode(['domain' => $existing['domain']]),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            Response::success(null, 'Domain deleted');
            break;
            
        default:
            Response::error('Method not allowed', 405);
    }
    
} catch (Exception $e) {
    error_log("Admin domains error: " . $e->getMessage());
    Response::serverError('Failed to process domain request');
}

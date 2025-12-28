<?php
/**
 * Admin Settings API
 * GET/PUT /api/admin/settings.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();

$user = Auth::requireAdmin();
$method = Response::getMethod();

try {
    if ($method === 'GET') {
        // Get all settings or specific category
        $category = $_GET['category'] ?? null;
        
        $sql = "SELECT * FROM app_settings";
        $params = [];
        
        if ($category) {
            $sql .= " WHERE category = ?";
            $params[] = $category;
        }
        
        $sql .= " ORDER BY category, key_name";
        $settings = Database::fetchAll($sql, $params);
        
        // Group by category
        $grouped = [];
        foreach ($settings as $setting) {
            $cat = $setting['category'] ?? 'general';
            if (!isset($grouped[$cat])) {
                $grouped[$cat] = [];
            }
            $grouped[$cat][$setting['key_name']] = [
                'value' => $setting['value'],
                'type' => $setting['value_type'] ?? 'string',
                'updated_at' => $setting['updated_at']
            ];
        }
        
        Response::success(['settings' => $grouped]);
        
    } elseif ($method === 'PUT') {
        // Update settings
        $input = Response::getJsonInput();
        $settings = $input['settings'] ?? [];
        
        if (empty($settings)) {
            Response::error('No settings provided');
        }
        
        Database::beginTransaction();
        
        foreach ($settings as $key => $value) {
            $category = $input['category'] ?? 'general';
            $valueType = is_bool($value) ? 'boolean' : (is_numeric($value) ? 'number' : 'string');
            $storedValue = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            
            // Upsert setting
            $existing = Database::fetchOne(
                "SELECT id FROM app_settings WHERE key_name = ? AND category = ?",
                [$key, $category]
            );
            
            if ($existing) {
                Database::update(
                    'app_settings',
                    [
                        'value' => $storedValue,
                        'value_type' => $valueType,
                        'updated_at' => date('Y-m-d H:i:s'),
                        'updated_by' => $user['id']
                    ],
                    'id = ?',
                    [$existing['id']]
                );
            } else {
                Database::insert('app_settings', [
                    'id' => Database::generateUUID(),
                    'key_name' => $key,
                    'value' => $storedValue,
                    'value_type' => $valueType,
                    'category' => $category,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                    'updated_by' => $user['id']
                ]);
            }
        }
        
        // Log audit
        Database::insert('admin_audit_logs', [
            'id' => Database::generateUUID(),
            'admin_id' => $user['id'],
            'action' => 'settings_updated',
            'entity_type' => 'settings',
            'details' => json_encode(['keys' => array_keys($settings)]),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        Database::commit();
        
        Response::success(null, 'Settings updated successfully');
        
    } else {
        Response::error('Method not allowed', 405);
    }
    
} catch (Exception $e) {
    if ($method === 'PUT') {
        Database::rollback();
    }
    error_log("Admin settings error: " . $e->getMessage());
    Response::serverError('Failed to process settings');
}

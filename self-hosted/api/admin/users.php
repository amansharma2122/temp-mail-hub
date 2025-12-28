<?php
/**
 * Admin Users Management
 * GET/PUT/DELETE /api/admin/users.php
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
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $limit = min(100, max(10, (int) ($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;
            $search = $_GET['search'] ?? '';
            
            $whereClause = '';
            $params = [];
            
            if (!empty($search)) {
                $whereClause = "WHERE u.email LIKE ? OR u.name LIKE ? OR p.display_name LIKE ?";
                $searchTerm = '%' . $search . '%';
                $params = [$searchTerm, $searchTerm, $searchTerm];
            }
            
            // Get total count
            $countSql = "SELECT COUNT(*) as count FROM users u 
                         LEFT JOIN profiles p ON p.user_id = u.id " . $whereClause;
            $total = Database::fetchOne($countSql, $params)['count'];
            
            // Get users
            $sql = "SELECT u.id, u.email, u.name, u.is_active, u.email_verified,
                           u.two_factor_enabled, u.created_at, u.last_login_at,
                           p.display_name, p.avatar_url,
                           (SELECT role FROM user_roles WHERE user_id = u.id LIMIT 1) as role,
                           (SELECT COUNT(*) FROM temp_emails WHERE user_id = u.id) as email_count
                    FROM users u
                    LEFT JOIN profiles p ON p.user_id = u.id
                    {$whereClause}
                    ORDER BY u.created_at DESC
                    LIMIT ? OFFSET ?";
            
            $params[] = $limit;
            $params[] = $offset;
            
            $users = Database::fetchAll($sql, $params);
            
            Response::success([
                'users' => $users,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => (int) $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ]);
            break;
            
        case 'PUT':
            $input = Response::getJsonInput();
            $userId = $input['id'] ?? $_GET['id'] ?? '';
            
            if (empty($userId)) {
                Response::error('User ID is required');
            }
            
            $targetUser = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
            
            if (!$targetUser) {
                Response::notFound('User not found');
            }
            
            $updates = [];
            $allowedFields = ['is_active', 'email_verified'];
            
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updates[$field] = $input[$field] ? 1 : 0;
                }
            }
            
            // Handle role change
            if (isset($input['role'])) {
                $validRoles = ['user', 'moderator', 'admin'];
                if (!in_array($input['role'], $validRoles)) {
                    Response::error('Invalid role');
                }
                
                // Remove existing roles and add new one
                Database::delete('user_roles', 'user_id = ?', [$userId]);
                
                if ($input['role'] !== 'user') {
                    Database::insert('user_roles', [
                        'id' => Database::generateUUID(),
                        'user_id' => $userId,
                        'role' => $input['role'],
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                }
            }
            
            if (!empty($updates)) {
                $updates['updated_at'] = date('Y-m-d H:i:s');
                Database::update('users', $updates, 'id = ?', [$userId]);
            }
            
            // Audit log
            Database::insert('admin_audit_logs', [
                'id' => Database::generateUUID(),
                'admin_id' => $user['id'],
                'action' => 'user_updated',
                'entity_type' => 'user',
                'entity_id' => $userId,
                'details' => json_encode($input),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            Response::success(null, 'User updated');
            break;
            
        case 'DELETE':
            $userId = $_GET['id'] ?? '';
            
            if (empty($userId)) {
                Response::error('User ID is required');
            }
            
            // Prevent self-deletion
            if ($userId === $user['id']) {
                Response::error('Cannot delete your own account');
            }
            
            $targetUser = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
            
            if (!$targetUser) {
                Response::notFound('User not found');
            }
            
            Database::beginTransaction();
            
            // Delete related data
            Database::delete('user_roles', 'user_id = ?', [$userId]);
            Database::delete('sessions', 'user_id = ?', [$userId]);
            Database::delete('profiles', 'user_id = ?', [$userId]);
            Database::delete('email_verifications', 'user_id = ?', [$userId]);
            Database::delete('password_resets', 'user_id = ?', [$userId]);
            
            // Delete temp emails and received emails
            $tempEmails = Database::fetchAll(
                "SELECT id FROM temp_emails WHERE user_id = ?",
                [$userId]
            );
            
            foreach ($tempEmails as $te) {
                Database::delete('received_emails', 'temp_email_id = ?', [$te['id']]);
            }
            
            Database::delete('temp_emails', 'user_id = ?', [$userId]);
            Database::delete('users', 'id = ?', [$userId]);
            
            Database::commit();
            
            // Audit log
            Database::insert('admin_audit_logs', [
                'id' => Database::generateUUID(),
                'admin_id' => $user['id'],
                'action' => 'user_deleted',
                'entity_type' => 'user',
                'entity_id' => $userId,
                'details' => json_encode(['email' => $targetUser['email']]),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            Response::success(null, 'User deleted');
            break;
            
        default:
            Response::error('Method not allowed', 405);
    }
    
} catch (Exception $e) {
    if ($method === 'DELETE') {
        Database::rollback();
    }
    error_log("Admin users error: " . $e->getMessage());
    Response::serverError('Failed to process user request');
}

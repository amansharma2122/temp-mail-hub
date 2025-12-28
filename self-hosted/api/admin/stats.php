<?php
/**
 * Admin Dashboard Stats
 * GET /api/admin/stats.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('GET');

Auth::requireAdmin();

try {
    // Get date range
    $period = $_GET['period'] ?? '7d';
    
    switch ($period) {
        case '24h':
            $startDate = date('Y-m-d H:i:s', strtotime('-24 hours'));
            break;
        case '7d':
            $startDate = date('Y-m-d', strtotime('-7 days'));
            break;
        case '30d':
            $startDate = date('Y-m-d', strtotime('-30 days'));
            break;
        case '90d':
            $startDate = date('Y-m-d', strtotime('-90 days'));
            break;
        default:
            $startDate = date('Y-m-d', strtotime('-7 days'));
    }
    
    // Total counts
    $totalUsers = Database::fetchOne("SELECT COUNT(*) as count FROM users")['count'];
    $totalEmails = Database::fetchOne("SELECT COUNT(*) as count FROM temp_emails")['count'];
    $activeEmails = Database::fetchOne(
        "SELECT COUNT(*) as count FROM temp_emails WHERE is_active = 1 AND expires_at > NOW()"
    )['count'];
    $totalReceived = Database::fetchOne("SELECT COUNT(*) as count FROM received_emails")['count'];
    $activeDomains = Database::fetchOne(
        "SELECT COUNT(*) as count FROM domains WHERE is_active = 1"
    )['count'];
    
    // Recent stats
    $recentStats = Database::fetchAll(
        "SELECT date, SUM(emails_created) as created, SUM(emails_received) as received
         FROM email_stats
         WHERE date >= ?
         GROUP BY date
         ORDER BY date ASC",
        [$startDate]
    );
    
    // New users in period
    $newUsers = Database::fetchOne(
        "SELECT COUNT(*) as count FROM users WHERE created_at >= ?",
        [$startDate]
    )['count'];
    
    // Active subscriptions
    $activeSubscriptions = Database::fetchOne(
        "SELECT COUNT(*) as count FROM user_subscriptions WHERE status = 'active'"
    )['count'];
    
    // Storage used (approximate from attachments)
    $storageUsed = Database::fetchOne(
        "SELECT COALESCE(SUM(size), 0) as total FROM email_attachments"
    )['total'];
    
    // Top domains by usage
    $topDomains = Database::fetchAll(
        "SELECT d.domain, COUNT(te.id) as email_count
         FROM domains d
         LEFT JOIN temp_emails te ON te.domain_id = d.id
         WHERE d.is_active = 1
         GROUP BY d.id
         ORDER BY email_count DESC
         LIMIT 5"
    );
    
    // Recent activity
    $recentActivity = Database::fetchAll(
        "SELECT action, entity_type, created_at
         FROM admin_audit_logs
         ORDER BY created_at DESC
         LIMIT 10"
    );
    
    Response::success([
        'overview' => [
            'total_users' => (int) $totalUsers,
            'new_users' => (int) $newUsers,
            'total_temp_emails' => (int) $totalEmails,
            'active_temp_emails' => (int) $activeEmails,
            'total_received_emails' => (int) $totalReceived,
            'active_domains' => (int) $activeDomains,
            'active_subscriptions' => (int) $activeSubscriptions,
            'storage_used_bytes' => (int) $storageUsed
        ],
        'chart_data' => $recentStats,
        'top_domains' => $topDomains,
        'recent_activity' => $recentActivity,
        'period' => $period
    ]);
    
} catch (Exception $e) {
    error_log("Admin stats error: " . $e->getMessage());
    Response::serverError('Failed to fetch stats');
}

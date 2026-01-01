<?php
/**
 * Logs Routes - Admin access to error logs
 */

function handleLogsRoute($action, $method, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $logger = ErrorLogger::getInstance(__DIR__ . '/../logs');

    switch ($action) {
        case 'recent':
            $type = $_GET['type'] ?? 'all';
            $limit = min(intval($_GET['limit'] ?? 100), 500);
            $search = $_GET['search'] ?? null;
            $level = $_GET['level'] ?? null;
            
            $logs = $logger->getRecentLogs($type, $limit, $search, $level);
            echo json_encode(['logs' => $logs, 'count' => count($logs)]);
            break;

        case 'stats':
            $stats = $logger->getLogStats();
            echo json_encode($stats);
            break;

        case 'clear':
            if ($method !== 'POST' && $method !== 'DELETE') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                return;
            }
            
            $type = $body['type'] ?? 'all';
            $logger->clearLogs($type);
            
            // Log the clear action
            $logger->info('Logs cleared by admin', ['type' => $type, 'admin_id' => $userId]);
            
            echo json_encode(['success' => true, 'message' => 'Logs cleared']);
            break;

        case 'download':
            $type = $_GET['type'] ?? 'error';
            $date = $_GET['date'] ?? date('Y-m-d');
            
            $logDir = __DIR__ . '/../logs';
            $filename = ($type === 'error' ? 'error-' : 'app-') . $date . '.log';
            $filepath = $logDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                http_response_code(404);
                echo json_encode(['error' => 'Log file not found']);
                return;
            }
            
            header('Content-Type: text/plain');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            readfile($filepath);
            exit;

        default:
            // Default: return recent errors
            $logs = $logger->getRecentLogs('error', 50);
            echo json_encode(['logs' => $logs, 'count' => count($logs)]);
    }
}

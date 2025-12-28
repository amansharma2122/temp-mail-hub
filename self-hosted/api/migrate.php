<?php
/**
 * Database Migration System
 * 
 * Automatically applies pending database migrations in order.
 * Tracks applied migrations in schema_migrations table.
 * 
 * Usage:
 *   CLI: php migrate.php
 *   Web: Access /api/migrate.php (requires admin auth or install mode)
 */

// Allow CLI or authenticated web access
$isCLI = php_sapi_name() === 'cli';
$isWebAuthorized = false;

if (!$isCLI) {
    header('Content-Type: application/json');
    
    // Check if in installation mode or has admin auth
    $configFile = __DIR__ . '/config.php';
    if (!file_exists($configFile)) {
        // Allow during installation
        $isWebAuthorized = true;
    } else {
        // Require admin authentication for web access
        require_once __DIR__ . '/core/auth.php';
        require_once __DIR__ . '/core/database.php';
        
        try {
            $user = Auth::getCurrentUser();
            if ($user && ($user['role'] === 'admin' || $user['role'] === 'super_admin')) {
                $isWebAuthorized = true;
            }
        } catch (Exception $e) {
            // Check for install mode flag
            session_start();
            if (isset($_SESSION['install_mode']) && $_SESSION['install_mode'] === true) {
                $isWebAuthorized = true;
            }
        }
    }
    
    if (!$isWebAuthorized) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
}

class Migrator {
    private $pdo;
    private $migrationsPath;
    private $results = [];
    
    public function __construct(PDO $pdo, string $migrationsPath) {
        $this->pdo = $pdo;
        $this->migrationsPath = $migrationsPath;
    }
    
    /**
     * Create migrations tracking table if not exists
     */
    public function ensureMigrationsTable(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS `schema_migrations` (
                `version` VARCHAR(20) NOT NULL PRIMARY KEY,
                `name` VARCHAR(255) NOT NULL,
                `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `checksum` VARCHAR(64) NULL,
                `execution_time_ms` INT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
    
    /**
     * Get list of applied migrations
     */
    public function getAppliedMigrations(): array {
        try {
            $stmt = $this->pdo->query("SELECT version FROM schema_migrations ORDER BY version");
            return $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) {
            return [];
        }
    }
    
    /**
     * Get list of pending migration files
     */
    public function getPendingMigrations(): array {
        $applied = $this->getAppliedMigrations();
        $pending = [];
        
        if (!is_dir($this->migrationsPath)) {
            return [];
        }
        
        $files = glob($this->migrationsPath . '/*.sql');
        sort($files); // Ensure order
        
        foreach ($files as $file) {
            $filename = basename($file);
            // Extract version from filename (e.g., 001_initial.sql -> 001)
            if (preg_match('/^(\d+)_/', $filename, $matches)) {
                $version = $matches[1];
                if (!in_array($version, $applied)) {
                    $pending[] = [
                        'version' => $version,
                        'file' => $file,
                        'name' => pathinfo($filename, PATHINFO_FILENAME),
                    ];
                }
            }
        }
        
        return $pending;
    }
    
    /**
     * Apply a single migration
     */
    public function applyMigration(array $migration): array {
        $startTime = microtime(true);
        $sql = file_get_contents($migration['file']);
        $checksum = hash('sha256', $sql);
        
        try {
            // Split into individual statements (handle ; inside strings carefully)
            $statements = $this->splitStatements($sql);
            
            $this->pdo->beginTransaction();
            
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (!empty($statement) && !$this->isComment($statement)) {
                    $this->pdo->exec($statement);
                }
            }
            
            // Record migration
            $stmt = $this->pdo->prepare("
                INSERT INTO schema_migrations (version, name, applied_at, checksum, execution_time_ms)
                VALUES (?, ?, NOW(), ?, ?)
            ");
            
            $executionTime = (int)((microtime(true) - $startTime) * 1000);
            $stmt->execute([
                $migration['version'],
                $migration['name'],
                $checksum,
                $executionTime
            ]);
            
            $this->pdo->commit();
            
            return [
                'success' => true,
                'version' => $migration['version'],
                'name' => $migration['name'],
                'execution_time_ms' => $executionTime,
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            return [
                'success' => false,
                'version' => $migration['version'],
                'name' => $migration['name'],
                'error' => $e->getMessage(),
            ];
        }
    }
    
    /**
     * Run all pending migrations
     */
    public function migrate(): array {
        $this->ensureMigrationsTable();
        
        $pending = $this->getPendingMigrations();
        
        if (empty($pending)) {
            return [
                'success' => true,
                'message' => 'No pending migrations',
                'applied' => [],
            ];
        }
        
        $results = [];
        $allSuccess = true;
        
        foreach ($pending as $migration) {
            $result = $this->applyMigration($migration);
            $results[] = $result;
            
            if (!$result['success']) {
                $allSuccess = false;
                break; // Stop on first error
            }
        }
        
        return [
            'success' => $allSuccess,
            'message' => $allSuccess 
                ? 'Applied ' . count($results) . ' migration(s)' 
                : 'Migration failed',
            'applied' => $results,
        ];
    }
    
    /**
     * Get current schema version
     */
    public function getCurrentVersion(): ?string {
        try {
            $stmt = $this->pdo->query("
                SELECT version FROM schema_migrations 
                ORDER BY version DESC LIMIT 1
            ");
            return $stmt->fetchColumn() ?: null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Get migration status
     */
    public function getStatus(): array {
        $this->ensureMigrationsTable();
        
        $applied = $this->getAppliedMigrations();
        $pending = $this->getPendingMigrations();
        
        return [
            'current_version' => $this->getCurrentVersion(),
            'applied_count' => count($applied),
            'pending_count' => count($pending),
            'pending' => array_map(function($m) {
                return ['version' => $m['version'], 'name' => $m['name']];
            }, $pending),
        ];
    }
    
    /**
     * Split SQL into individual statements
     */
    private function splitStatements(string $sql): array {
        // Simple split on semicolon - good enough for our migrations
        // For complex migrations with procedures, use DELIMITER
        $statements = [];
        $current = '';
        $inString = false;
        $stringChar = '';
        
        for ($i = 0; $i < strlen($sql); $i++) {
            $char = $sql[$i];
            $prev = $i > 0 ? $sql[$i - 1] : '';
            
            if ($inString) {
                $current .= $char;
                if ($char === $stringChar && $prev !== '\\') {
                    $inString = false;
                }
            } else {
                if ($char === "'" || $char === '"') {
                    $inString = true;
                    $stringChar = $char;
                    $current .= $char;
                } elseif ($char === ';') {
                    $statements[] = $current;
                    $current = '';
                } else {
                    $current .= $char;
                }
            }
        }
        
        if (trim($current)) {
            $statements[] = $current;
        }
        
        return $statements;
    }
    
    /**
     * Check if statement is just a comment
     */
    private function isComment(string $statement): bool {
        $trimmed = trim($statement);
        return strpos($trimmed, '--') === 0 
            || strpos($trimmed, '#') === 0
            || (strpos($trimmed, '/*') === 0 && strpos($trimmed, '*/') === strlen($trimmed) - 2);
    }
}

// Main execution
try {
    // Get database connection
    $configFile = __DIR__ . '/config.php';
    
    if (file_exists($configFile)) {
        $config = require $configFile;
        $dbConfig = $config['database'] ?? $config['db'] ?? null;
        
        if (!$dbConfig) {
            throw new Exception('Database configuration not found');
        }
        
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $dbConfig['host'] ?? 'localhost',
            $dbConfig['port'] ?? 3306,
            $dbConfig['name'] ?? $dbConfig['dbname'] ?? '',
            $dbConfig['charset'] ?? 'utf8mb4'
        );
        
        $pdo = new PDO($dsn, $dbConfig['username'] ?? $dbConfig['user'] ?? '', $dbConfig['password'] ?? $dbConfig['pass'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } else {
        // Get from session during install
        session_start();
        $install = $_SESSION['install'] ?? [];
        
        if (empty($install['db_host'])) {
            throw new Exception('No database configuration available');
        }
        
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            $install['db_host'],
            $install['db_name']
        );
        
        $pdo = new PDO($dsn, $install['db_user'], $install['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    
    $migrationsPath = dirname(__DIR__) . '/database/migrations';
    $migrator = new Migrator($pdo, $migrationsPath);
    
    // Handle CLI arguments or web actions
    $action = $isCLI ? ($argv[1] ?? 'migrate') : ($_GET['action'] ?? 'migrate');
    
    switch ($action) {
        case 'status':
            $result = $migrator->getStatus();
            break;
            
        case 'migrate':
        default:
            $result = $migrator->migrate();
            break;
    }
    
    if ($isCLI) {
        echo "Migration Status:\n";
        echo "================\n";
        print_r($result);
    } else {
        echo json_encode($result, JSON_PRETTY_PRINT);
    }
    
} catch (Exception $e) {
    $error = ['success' => false, 'error' => $e->getMessage()];
    
    if ($isCLI) {
        echo "Error: " . $e->getMessage() . "\n";
        exit(1);
    } else {
        http_response_code(500);
        echo json_encode($error);
    }
}

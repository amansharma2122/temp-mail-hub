<?php
/**
 * One-Click Installer Script
 * 
 * Access via: https://yourdomain.com/install.php
 * This script automates database setup and initial configuration
 */

session_start();

// Security: Check if already installed
$configFile = __DIR__ . '/api/config.php';
if (file_exists($configFile)) {
    $config = include $configFile;
    if (!empty($config['db']['host'])) {
        die('<h1>Already Installed</h1><p>Delete config.php to reinstall.</p>');
    }
}

// Handle form submission
$step = $_GET['step'] ?? 1;
$errors = [];
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($step) {
        case 1:
            // Test database connection
            $dbHost = trim($_POST['db_host'] ?? '');
            $dbName = trim($_POST['db_name'] ?? '');
            $dbUser = trim($_POST['db_user'] ?? '');
            $dbPass = $_POST['db_pass'] ?? '';
            
            if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
                $errors[] = 'All database fields are required';
            } else {
                try {
                    $pdo = new PDO(
                        "mysql:host={$dbHost};charset=utf8mb4",
                        $dbUser,
                        $dbPass,
                        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                    );
                    
                    // Create database if not exists
                    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    $pdo->exec("USE `{$dbName}`");
                    
                    // Store in session
                    $_SESSION['install'] = [
                        'db_host' => $dbHost,
                        'db_name' => $dbName,
                        'db_user' => $dbUser,
                        'db_pass' => $dbPass
                    ];
                    
                    header('Location: install.php?step=2');
                    exit;
                } catch (PDOException $e) {
                    $errors[] = 'Database connection failed: ' . $e->getMessage();
                }
            }
            break;
            
        case 2:
            // Site configuration
            $siteUrl = rtrim(trim($_POST['site_url'] ?? ''), '/');
            $siteName = trim($_POST['site_name'] ?? '');
            $adminEmail = trim($_POST['admin_email'] ?? '');
            $adminPass = $_POST['admin_pass'] ?? '';
            $adminPassConfirm = $_POST['admin_pass_confirm'] ?? '';
            
            if (empty($siteUrl) || empty($siteName) || empty($adminEmail) || empty($adminPass)) {
                $errors[] = 'All fields are required';
            } elseif (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'Invalid email address';
            } elseif (strlen($adminPass) < 8) {
                $errors[] = 'Password must be at least 8 characters';
            } elseif ($adminPass !== $adminPassConfirm) {
                $errors[] = 'Passwords do not match';
            } else {
                $_SESSION['install']['site_url'] = $siteUrl;
                $_SESSION['install']['site_name'] = $siteName;
                $_SESSION['install']['admin_email'] = $adminEmail;
                $_SESSION['install']['admin_pass'] = $adminPass;
                
                header('Location: install.php?step=3');
                exit;
            }
            break;
            
        case 3:
            // SMTP configuration (optional)
            $_SESSION['install']['smtp_host'] = trim($_POST['smtp_host'] ?? '');
            $_SESSION['install']['smtp_port'] = (int) ($_POST['smtp_port'] ?? 587);
            $_SESSION['install']['smtp_user'] = trim($_POST['smtp_user'] ?? '');
            $_SESSION['install']['smtp_pass'] = $_POST['smtp_pass'] ?? '';
            $_SESSION['install']['smtp_from'] = trim($_POST['smtp_from'] ?? '');
            $_SESSION['install']['smtp_name'] = trim($_POST['smtp_name'] ?? '');
            
            header('Location: install.php?step=4');
            exit;
            break;
            
        case 4:
            // IMAP configuration (optional)
            $_SESSION['install']['imap_host'] = trim($_POST['imap_host'] ?? '');
            $_SESSION['install']['imap_port'] = (int) ($_POST['imap_port'] ?? 993);
            $_SESSION['install']['imap_user'] = trim($_POST['imap_user'] ?? '');
            $_SESSION['install']['imap_pass'] = $_POST['imap_pass'] ?? '';
            
            header('Location: install.php?step=5');
            exit;
            break;
            
        case 5:
            // Run installation
            $install = $_SESSION['install'] ?? [];
            
            if (empty($install['db_host'])) {
                header('Location: install.php?step=1');
                exit;
            }
            
            try {
                // Connect to database
                $pdo = new PDO(
                    "mysql:host={$install['db_host']};dbname={$install['db_name']};charset=utf8mb4",
                    $install['db_user'],
                    $install['db_pass'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                // Run schema
                $schema = file_get_contents(__DIR__ . '/database/schema.mysql.sql');
                $pdo->exec($schema);
                
                // Generate encryption keys
                $jwtSecret = bin2hex(random_bytes(32));
                $encryptionKey = bin2hex(random_bytes(32));
                
                // Create admin user
                $adminId = bin2hex(random_bytes(16));
                $passwordHash = password_hash($install['admin_pass'], PASSWORD_ARGON2ID);
                
                $stmt = $pdo->prepare("
                    INSERT INTO users (id, email, password_hash, role, is_active, email_verified_at, created_at, updated_at)
                    VALUES (?, ?, ?, 'super_admin', 1, NOW(), NOW(), NOW())
                ");
                $stmt->execute([$adminId, $install['admin_email'], $passwordHash]);
                
                // Add default domain
                $defaultDomain = parse_url($install['site_url'], PHP_URL_HOST);
                $stmt = $pdo->prepare("
                    INSERT INTO temp_email_domains (domain, is_active, is_premium, created_at)
                    VALUES (?, 1, 0, NOW())
                    ON DUPLICATE KEY UPDATE is_active = 1
                ");
                $stmt->execute([$defaultDomain]);
                
                // Add default settings
                $defaultSettings = [
                    ['site_name', $install['site_name']],
                    ['site_url', $install['site_url']],
                    ['default_email_expiry', '3600'],
                    ['max_emails_per_session', '10'],
                    ['enable_attachments', '1'],
                    ['max_attachment_size', '10485760'],
                    ['enable_registration', '1'],
                    ['require_email_verification', '1'],
                    ['imap_poll_interval', '10'],
                    ['enable_realtime', '1'],
                ];
                
                $stmt = $pdo->prepare("
                    INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
                    VALUES (?, ?, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                ");
                
                foreach ($defaultSettings as $setting) {
                    $stmt->execute($setting);
                }
                
                // Create config.php
                $configContent = "<?php
/**
 * Application Configuration
 * Generated by installer on " . date('Y-m-d H:i:s') . "
 */

return [
    // Database
    'db' => [
        'host' => " . var_export($install['db_host'], true) . ",
        'name' => " . var_export($install['db_name'], true) . ",
        'user' => " . var_export($install['db_user'], true) . ",
        'pass' => " . var_export($install['db_pass'], true) . ",
        'charset' => 'utf8mb4',
    ],
    
    // Site
    'site' => [
        'url' => " . var_export($install['site_url'], true) . ",
        'name' => " . var_export($install['site_name'], true) . ",
    ],
    
    // Security
    'security' => [
        'jwt_secret' => " . var_export($jwtSecret, true) . ",
        'encryption_key' => " . var_export($encryptionKey, true) . ",
        'jwt_expiry' => 86400 * 7, // 7 days
        'password_min_length' => 8,
    ],
    
    // SMTP
    'smtp' => [
        'host' => " . var_export($install['smtp_host'], true) . ",
        'port' => " . var_export($install['smtp_port'], true) . ",
        'username' => " . var_export($install['smtp_user'], true) . ",
        'password' => " . var_export($install['smtp_pass'], true) . ",
        'from_email' => " . var_export($install['smtp_from'] ?: $install['admin_email'], true) . ",
        'from_name' => " . var_export($install['smtp_name'] ?: $install['site_name'], true) . ",
        'encryption' => 'tls',
    ],
    
    // IMAP
    'imap' => [
        'host' => " . var_export($install['imap_host'], true) . ",
        'port' => " . var_export($install['imap_port'], true) . ",
        'username' => " . var_export($install['imap_user'], true) . ",
        'password' => " . var_export($install['imap_pass'], true) . ",
        'encryption' => 'ssl',
        'poll_interval' => 10,
    ],
    
    // Email Settings
    'email' => [
        'default_expiry' => 3600,
        'max_per_session' => 10,
        'max_attachment_size' => 10 * 1024 * 1024,
        'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip'],
    ],
    
    // Rate Limiting
    'rate_limit' => [
        'emails_per_hour' => 20,
        'requests_per_minute' => 60,
    ],
    
    // Stripe (optional)
    'stripe' => [
        'secret_key' => '',
        'publishable_key' => '',
        'webhook_secret' => '',
    ],
];
";
                
                file_put_contents($configFile, $configContent);
                
                // Clear session
                unset($_SESSION['install']);
                
                $success = true;
                
            } catch (Exception $e) {
                $errors[] = 'Installation failed: ' . $e->getMessage();
            }
            break;
    }
}

// Get current install data
$install = $_SESSION['install'] ?? [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TempMail Installation</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 2rem;
            color: #e4e4e7;
        }
        .container { max-width: 600px; margin: 0 auto; }
        .card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            padding: 2rem;
            backdrop-filter: blur(10px);
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        .logo h1 { 
            font-size: 2rem; 
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .logo p { color: #a1a1aa; margin-top: 0.5rem; }
        .steps {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin-bottom: 2rem;
        }
        .step {
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.875rem;
            background: rgba(255, 255, 255, 0.1);
            color: #a1a1aa;
        }
        .step.active { background: #3b82f6; color: white; }
        .step.done { background: #22c55e; color: white; }
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 0.5rem;
            background: rgba(0, 0, 0, 0.3);
            color: white;
            font-size: 1rem;
        }
        input:focus { outline: none; border-color: #3b82f6; }
        input::placeholder { color: #71717a; }
        .hint { font-size: 0.875rem; color: #a1a1aa; margin-top: 0.25rem; }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: rgba(255, 255, 255, 0.1); color: white; }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.2); }
        .btn-group { display: flex; gap: 1rem; margin-top: 2rem; }
        .error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        .success-card {
            text-align: center;
            padding: 3rem 2rem;
        }
        .success-icon {
            width: 4rem;
            height: 4rem;
            background: #22c55e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2rem;
        }
        .success-card h2 { color: #22c55e; margin-bottom: 1rem; }
        .success-card p { color: #a1a1aa; margin-bottom: 1.5rem; }
        .checklist { text-align: left; margin: 2rem 0; }
        .checklist li { 
            padding: 0.75rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .check { color: #22c55e; }
        .section-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .skip-link {
            color: #a1a1aa;
            text-decoration: underline;
            cursor: pointer;
            font-size: 0.875rem;
        }
        .skip-link:hover { color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>📧 TempMail</h1>
            <p>One-Click Installation</p>
        </div>
        
        <div class="steps">
            <div class="step <?= $step >= 1 ? ($step > 1 ? 'done' : 'active') : '' ?>">1</div>
            <div class="step <?= $step >= 2 ? ($step > 2 ? 'done' : 'active') : '' ?>">2</div>
            <div class="step <?= $step >= 3 ? ($step > 3 ? 'done' : 'active') : '' ?>">3</div>
            <div class="step <?= $step >= 4 ? ($step > 4 ? 'done' : 'active') : '' ?>">4</div>
            <div class="step <?= $step >= 5 ? 'active' : '' ?>">5</div>
        </div>
        
        <div class="card">
            <?php if (!empty($errors)): ?>
                <div class="error">
                    <?php foreach ($errors as $error): ?>
                        <p><?= htmlspecialchars($error) ?></p>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
            
            <?php if ($success): ?>
                <div class="success-card">
                    <div class="success-icon">✓</div>
                    <h2>Installation Complete!</h2>
                    <p>Your TempMail application has been successfully installed.</p>
                    
                    <ul class="checklist">
                        <li><span class="check">✓</span> Database tables created</li>
                        <li><span class="check">✓</span> Admin account created</li>
                        <li><span class="check">✓</span> Configuration file generated</li>
                        <li><span class="check">✓</span> Default settings applied</li>
                    </ul>
                    
                    <div class="btn-group" style="justify-content: center;">
                        <a href="/" class="btn btn-primary">Go to Homepage</a>
                        <a href="/admin" class="btn btn-secondary">Admin Panel</a>
                    </div>
                    
                    <p style="margin-top: 2rem; color: #ef4444; font-weight: 500;">
                        ⚠️ Delete this install.php file for security!
                    </p>
                </div>
            <?php elseif ($step == 1): ?>
                <h2 class="section-title">Database Configuration</h2>
                <form method="POST">
                    <div class="form-group">
                        <label for="db_host">Database Host</label>
                        <input type="text" id="db_host" name="db_host" value="localhost" required>
                        <p class="hint">Usually "localhost" for shared hosting</p>
                    </div>
                    <div class="form-group">
                        <label for="db_name">Database Name</label>
                        <input type="text" id="db_name" name="db_name" required>
                        <p class="hint">Create this in cPanel → MySQL Databases</p>
                    </div>
                    <div class="form-group">
                        <label for="db_user">Database Username</label>
                        <input type="text" id="db_user" name="db_user" required>
                    </div>
                    <div class="form-group">
                        <label for="db_pass">Database Password</label>
                        <input type="password" id="db_pass" name="db_pass">
                    </div>
                    <div class="btn-group">
                        <button type="submit" class="btn btn-primary">Test Connection & Continue →</button>
                    </div>
                </form>
            <?php elseif ($step == 2): ?>
                <h2 class="section-title">Site & Admin Setup</h2>
                <form method="POST">
                    <div class="form-group">
                        <label for="site_url">Site URL</label>
                        <input type="url" id="site_url" name="site_url" 
                               value="<?= htmlspecialchars('https://' . $_SERVER['HTTP_HOST']) ?>" required>
                    </div>
                    <div class="form-group">
                        <label for="site_name">Site Name</label>
                        <input type="text" id="site_name" name="site_name" value="TempMail" required>
                    </div>
                    <div class="form-group">
                        <label for="admin_email">Admin Email</label>
                        <input type="email" id="admin_email" name="admin_email" required>
                    </div>
                    <div class="form-group">
                        <label for="admin_pass">Admin Password</label>
                        <input type="password" id="admin_pass" name="admin_pass" required minlength="8">
                        <p class="hint">Minimum 8 characters</p>
                    </div>
                    <div class="form-group">
                        <label for="admin_pass_confirm">Confirm Password</label>
                        <input type="password" id="admin_pass_confirm" name="admin_pass_confirm" required>
                    </div>
                    <div class="btn-group">
                        <a href="install.php?step=1" class="btn btn-secondary">← Back</a>
                        <button type="submit" class="btn btn-primary">Continue →</button>
                    </div>
                </form>
            <?php elseif ($step == 3): ?>
                <h2 class="section-title">SMTP Configuration (Optional)</h2>
                <p style="color: #a1a1aa; margin-bottom: 1.5rem;">Required for sending verification emails and password resets.</p>
                <form method="POST">
                    <div class="form-group">
                        <label for="smtp_host">SMTP Host</label>
                        <input type="text" id="smtp_host" name="smtp_host" placeholder="smtp.gmail.com">
                    </div>
                    <div class="form-group">
                        <label for="smtp_port">SMTP Port</label>
                        <input type="number" id="smtp_port" name="smtp_port" value="587">
                    </div>
                    <div class="form-group">
                        <label for="smtp_user">SMTP Username</label>
                        <input type="text" id="smtp_user" name="smtp_user" placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="smtp_pass">SMTP Password</label>
                        <input type="password" id="smtp_pass" name="smtp_pass">
                    </div>
                    <div class="form-group">
                        <label for="smtp_from">From Email</label>
                        <input type="email" id="smtp_from" name="smtp_from" placeholder="noreply@yourdomain.com">
                    </div>
                    <div class="form-group">
                        <label for="smtp_name">From Name</label>
                        <input type="text" id="smtp_name" name="smtp_name" placeholder="TempMail">
                    </div>
                    <div class="btn-group">
                        <a href="install.php?step=2" class="btn btn-secondary">← Back</a>
                        <button type="submit" class="btn btn-primary">Continue →</button>
                    </div>
                    <p style="text-align: center; margin-top: 1rem;">
                        <a href="install.php?step=4" class="skip-link">Skip this step →</a>
                    </p>
                </form>
            <?php elseif ($step == 4): ?>
                <h2 class="section-title">IMAP Configuration (Optional)</h2>
                <p style="color: #a1a1aa; margin-bottom: 1.5rem;">Required for receiving emails via IMAP polling.</p>
                <form method="POST">
                    <div class="form-group">
                        <label for="imap_host">IMAP Host</label>
                        <input type="text" id="imap_host" name="imap_host" placeholder="imap.gmail.com">
                    </div>
                    <div class="form-group">
                        <label for="imap_port">IMAP Port</label>
                        <input type="number" id="imap_port" name="imap_port" value="993">
                    </div>
                    <div class="form-group">
                        <label for="imap_user">IMAP Username</label>
                        <input type="text" id="imap_user" name="imap_user" placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="imap_pass">IMAP Password</label>
                        <input type="password" id="imap_pass" name="imap_pass">
                    </div>
                    <div class="btn-group">
                        <a href="install.php?step=3" class="btn btn-secondary">← Back</a>
                        <button type="submit" class="btn btn-primary">Continue →</button>
                    </div>
                    <p style="text-align: center; margin-top: 1rem;">
                        <a href="install.php?step=5" class="skip-link">Skip this step →</a>
                    </p>
                </form>
            <?php elseif ($step == 5): ?>
                <h2 class="section-title">Ready to Install</h2>
                <p style="color: #a1a1aa; margin-bottom: 1.5rem;">Review your configuration and click Install to complete setup.</p>
                
                <ul class="checklist">
                    <li><span class="check">✓</span> Database: <?= htmlspecialchars($install['db_name'] ?? 'N/A') ?></li>
                    <li><span class="check">✓</span> Site: <?= htmlspecialchars($install['site_name'] ?? 'N/A') ?></li>
                    <li><span class="check">✓</span> Admin: <?= htmlspecialchars($install['admin_email'] ?? 'N/A') ?></li>
                    <li><span class="check"><?= !empty($install['smtp_host']) ? '✓' : '○' ?></span> SMTP: <?= !empty($install['smtp_host']) ? 'Configured' : 'Skipped' ?></li>
                    <li><span class="check"><?= !empty($install['imap_host']) ? '✓' : '○' ?></span> IMAP: <?= !empty($install['imap_host']) ? 'Configured' : 'Skipped' ?></li>
                </ul>
                
                <form method="POST">
                    <div class="btn-group">
                        <a href="install.php?step=4" class="btn btn-secondary">← Back</a>
                        <button type="submit" class="btn btn-primary">🚀 Install Now</button>
                    </div>
                </form>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>

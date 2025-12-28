<?php
/**
 * ============================================================================
 * SELF-HOSTED TEMP EMAIL - CONFIGURATION FILE
 * ============================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to config.php (same folder)
 * 2. Fill in your actual values (see examples below)
 * 3. Generate secure secrets using: openssl rand -hex 32
 *    Or use online generator: https://randomkeygen.com/
 * 
 * ============================================================================
 */

return [

    // =========================================================================
    // SECTION 1: DATABASE CONNECTION
    // =========================================================================
    // These settings connect your app to MySQL database.
    // You get these from cPanel > MySQL Databases after creating a database.
    //
    // HOW TO FIND YOUR DATABASE DETAILS IN CPANEL:
    // 1. Login to cPanel
    // 2. Go to "MySQL Databases"
    // 3. Create a new database (e.g., "tempemail")
    // 4. Create a new user with a strong password
    // 5. Add the user to the database with "ALL PRIVILEGES"
    // 6. Your database name will be: cpanelusername_databasename
    //    Your username will be: cpanelusername_username
    // =========================================================================
    
    'database' => [
        // Database server - usually 'localhost' on shared hosting
        // Examples:
        //   'localhost'           - Most common for cPanel
        //   '127.0.0.1'           - Alternative localhost
        //   'mysql.yourhost.com'  - Remote database server
        'host' => 'localhost',
        
        // MySQL port - almost always 3306
        'port' => 3306,
        
        // Your database name from cPanel
        // Format: cpanelusername_databasename
        // Example: If your cPanel username is "john" and you created 
        //          a database called "tempemail", it becomes:
        'name' => 'john_tempemail',   // ← CHANGE THIS
        
        // Database username from cPanel
        // Format: cpanelusername_dbuser
        // Example: If your cPanel username is "john" and you created
        //          a user called "mailuser", it becomes:
        'username' => 'john_mailuser', // ← CHANGE THIS
        
        // The password you set when creating the database user
        'password' => 'YourSecurePassword123!', // ← CHANGE THIS
        
        // Character set - keep as utf8mb4 for emoji support
        'charset' => 'utf8mb4',
    ],

    // =========================================================================
    // SECTION 2: APPLICATION SETTINGS
    // =========================================================================
    // Basic settings for your temp email service
    // =========================================================================
    
    'app' => [
        // Your site name - appears in emails and UI
        'name' => 'TempMail',         // ← CHANGE THIS
        
        // Your full domain URL (no trailing slash!)
        // Examples:
        //   'https://tempmail.com'
        //   'https://mail.mydomain.com'
        //   'https://mydomain.com/tempmail'  (if in subfolder)
        'url' => 'https://yourdomain.com', // ← CHANGE THIS
        
        // Debug mode - set to true only when troubleshooting
        // WARNING: Never enable in production!
        'debug' => false,
        
        // Timezone for dates/times
        // List: https://www.php.net/manual/en/timezones.php
        // Examples: 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'
        'timezone' => 'UTC',
    ],

    // =========================================================================
    // SECTION 3: SECURITY SETTINGS
    // =========================================================================
    // IMPORTANT: Generate unique secrets for your installation!
    // 
    // HOW TO GENERATE SECRETS:
    // Option 1 - Terminal: openssl rand -hex 32
    // Option 2 - PHP: Run this in browser: 
    //            <?php echo bin2hex(random_bytes(32)); ?>
    // Option 3 - Online: https://randomkeygen.com/ (use "CodeIgniter Encryption Keys")
    // =========================================================================
    
    'security' => [
        // JWT Secret - used to sign authentication tokens
        // MUST be unique and secret! Generate a new one:
        // Example output from openssl: a3f8b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2
        'jwt_secret' => 'PASTE_YOUR_64_CHARACTER_SECRET_HERE', // ← CHANGE THIS
        
        // How long users stay logged in (in hours)
        // Examples: 24 (1 day), 168 (1 week), 720 (30 days)
        'jwt_expiry_hours' => 24,
        
        // Encryption key - used to encrypt sensitive email data
        // MUST be different from jwt_secret! Generate another:
        'encryption_key' => 'PASTE_ANOTHER_64_CHARACTER_SECRET_HERE', // ← CHANGE THIS
        
        // CORS - Which domains can access your API
        // Add your frontend domain(s) here
        'allowed_origins' => [
            'https://yourdomain.com',      // ← CHANGE THIS (your main domain)
            'https://www.yourdomain.com',  // ← CHANGE THIS (with www)
            // 'http://localhost:5173',    // Uncomment for local development
        ],
    ],

    // =========================================================================
    // SECTION 4: WEBHOOKS (INSTANT EMAIL DELIVERY) - RECOMMENDED
    // =========================================================================
    // Webhooks provide INSTANT email delivery. Your email provider sends
    // emails directly to your webhook endpoint the moment they arrive.
    //
    // WEBHOOK URL FORMAT: https://yourdomain.com/api/emails/webhook.php
    //
    // SUPPORTED PROVIDERS:
    // - ForwardEmail.net (recommended for beginners)
    // - Mailgun
    // - SendGrid
    // - Postmark
    // - Amazon SES
    // - Any custom provider with JSON webhook support
    //
    // See WEBHOOK-SETUP.md for detailed provider configuration
    // =========================================================================
    
    'webhooks' => [
        // Enable webhook email delivery (recommended: true)
        'enabled' => true,
        
        // Provider signature verification secrets
        // These verify that webhook requests really come from your provider
        // Leave a provider commented out if you're not using it
        'secrets' => [
            // ═══════════════════════════════════════════════════════════════
            // FORWARDEMAIL.NET (Recommended for beginners)
            // ═══════════════════════════════════════════════════════════════
            // 1. Go to https://forwardemail.net
            // 2. Add your domain and verify DNS
            // 3. Go to Webhooks > Create Webhook
            // 4. Set URL: https://yourdomain.com/api/emails/webhook.php
            // 5. Copy the webhook secret and paste below
            // 'forwardemail' => 'your-forwardemail-webhook-secret',
            
            // ═══════════════════════════════════════════════════════════════
            // MAILGUN
            // ═══════════════════════════════════════════════════════════════
            // 1. Login to Mailgun dashboard
            // 2. Go to Sending > Webhooks
            // 3. Use your API key as the secret
            // 'mailgun' => 'key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            
            // ═══════════════════════════════════════════════════════════════
            // SENDGRID
            // ═══════════════════════════════════════════════════════════════
            // 1. Login to SendGrid
            // 2. Go to Settings > Inbound Parse
            // 3. Use Signed Event Webhook Verification
            // 'sendgrid' => 'your-sendgrid-webhook-signing-secret',
            
            // ═══════════════════════════════════════════════════════════════
            // POSTMARK
            // ═══════════════════════════════════════════════════════════════
            // 1. Login to Postmark
            // 2. Go to Servers > Your Server > Inbound
            // 3. Use your Server API Token
            // 'postmark' => 'your-postmark-server-token',
            
            // ═══════════════════════════════════════════════════════════════
            // CUSTOM PROVIDER
            // ═══════════════════════════════════════════════════════════════
            // For providers sending X-Webhook-Secret header
            // 'custom' => 'any-secret-you-configure-in-provider',
        ],
        
        // Max webhook requests per minute per IP (DDoS protection)
        'rate_limit_per_minute' => 100,
    ],

    // =========================================================================
    // SECTION 5: REAL-TIME UPDATES (Server-Sent Events)
    // =========================================================================
    // This makes the inbox update automatically without refreshing the page.
    // Works alongside webhooks or IMAP polling.
    // =========================================================================
    
    'realtime' => [
        // Enable real-time updates in the browser
        'enabled' => true,
        
        // How often to check for new emails (milliseconds)
        // 3000 = 3 seconds (good balance of speed vs server load)
        // 1000 = 1 second (faster but more server load)
        'poll_interval_ms' => 3000,
        
        // Max SSE connection time before reconnecting (seconds)
        // 30 seconds works well for most setups
        'connection_timeout' => 30,
    ],

    // =========================================================================
    // SECTION 6: IMAP SETTINGS (ALTERNATIVE TO WEBHOOKS)
    // =========================================================================
    // Use IMAP if your email provider doesn't support webhooks.
    // IMAP polls your mailbox periodically (slower than webhooks).
    //
    // HOW TO FIND IMAP SETTINGS:
    // 1. In cPanel, go to "Email Accounts"
    // 2. Click "Connect Devices" on your email account
    // 3. Look for "Manual Settings" > "Incoming Server"
    //
    // COMMON IMAP SERVERS:
    // - cPanel Hosting: mail.yourdomain.com (port 993, SSL)
    // - Gmail: imap.gmail.com (port 993, SSL)
    // - Outlook: outlook.office365.com (port 993, SSL)
    // =========================================================================
    
    'imap' => [
        // Enable IMAP polling (set false if using webhooks only)
        'enabled' => false,  // ← Set to true if not using webhooks
        
        // IMAP server hostname
        // Usually: mail.yourdomain.com
        'host' => 'mail.yourdomain.com', // ← CHANGE THIS
        
        // IMAP port
        // 993 = SSL (recommended)
        // 143 = No encryption or STARTTLS
        'port' => 993,
        
        // Email account to check
        // This should be a catch-all email that receives ALL emails
        // to your domain, regardless of the address
        // Example: catchall@yourdomain.com or *@yourdomain.com
        'username' => 'catchall@yourdomain.com', // ← CHANGE THIS
        
        // Password for the email account above
        'password' => 'YourEmailPassword123!', // ← CHANGE THIS
        
        // Encryption type
        // 'ssl'  = Recommended (port 993)
        // 'tls'  = STARTTLS (port 143)
        // 'none' = No encryption (not recommended)
        'encryption' => 'ssl',
        
        // IMAP folder to check
        // Usually 'INBOX', but could be different
        'folder' => 'INBOX',
        
        // How often to check for new emails (seconds)
        // 60 = Every minute
        // 120 = Every 2 minutes (recommended to reduce server load)
        'poll_interval' => 120,
        
        // Maximum emails to process per poll
        // Higher = more emails processed, but slower
        'max_emails_per_poll' => 50,
    ],

    // =========================================================================
    // SECTION 7: SMTP SETTINGS (FOR SENDING EMAILS)
    // =========================================================================
    // Used to send verification emails, password resets, etc.
    // You need an email account that can SEND emails.
    //
    // HOW TO FIND SMTP SETTINGS IN CPANEL:
    // 1. Go to "Email Accounts"
    // 2. Click "Connect Devices" on your email account
    // 3. Look for "Manual Settings" > "Outgoing Server"
    //
    // COMMON SMTP SERVERS:
    // - cPanel Hosting: mail.yourdomain.com (port 587, TLS or port 465, SSL)
    // - Gmail: smtp.gmail.com (port 587, TLS) - requires App Password
    // - SendGrid: smtp.sendgrid.net (port 587, TLS)
    // =========================================================================
    
    'smtp' => [
        // Enable SMTP (required for email verification)
        'enabled' => true,
        
        // SMTP server hostname
        'host' => 'mail.yourdomain.com', // ← CHANGE THIS
        
        // SMTP port
        // 587 = TLS (recommended)
        // 465 = SSL
        // 25  = No encryption (often blocked)
        'port' => 587,
        
        // SMTP username (usually your full email address)
        'username' => 'noreply@yourdomain.com', // ← CHANGE THIS
        
        // SMTP password
        'password' => 'YourEmailPassword123!', // ← CHANGE THIS
        
        // Encryption type
        // 'tls' = Recommended for port 587
        // 'ssl' = For port 465
        // ''    = No encryption (not recommended)
        'encryption' => 'tls',
        
        // From address for outgoing emails
        'from_email' => 'noreply@yourdomain.com', // ← CHANGE THIS
        
        // From name shown in email clients
        'from_name' => 'TempMail', // ← CHANGE THIS
    ],

    // =========================================================================
    // SECTION 8: STRIPE PAYMENTS (OPTIONAL)
    // =========================================================================
    // Enable premium subscriptions with Stripe.
    // Leave disabled if you don't want paid features.
    //
    // HOW TO SET UP STRIPE:
    // 1. Create account at https://stripe.com
    // 2. Get API keys from Dashboard > Developers > API Keys
    // 3. Set up webhook at Dashboard > Developers > Webhooks
    //    Webhook URL: https://yourdomain.com/api/stripe/webhook.php
    //    Events: checkout.session.completed, customer.subscription.*
    // =========================================================================
    
    'stripe' => [
        // Enable Stripe payments
        'enabled' => false, // ← Set to true to enable
        
        // Stripe Secret Key (starts with sk_live_ or sk_test_)
        // Find at: Dashboard > Developers > API Keys
        // Use sk_test_ for testing, sk_live_ for production
        'secret_key' => 'sk_live_xxxxxxxxxxxxxxxxxxxxxxxx', // ← CHANGE THIS
        
        // Webhook Signing Secret (starts with whsec_)
        // Find at: Dashboard > Developers > Webhooks > Your Endpoint
        'webhook_secret' => 'whsec_xxxxxxxxxxxxxxxxxxxxxxxx', // ← CHANGE THIS
    ],

    // =========================================================================
    // SECTION 9: RATE LIMITING (SECURITY)
    // =========================================================================
    // Prevents abuse by limiting how many actions users can perform.
    // Adjust based on your needs and server capacity.
    // =========================================================================
    
    'rate_limits' => [
        // Max temporary emails a user can create per hour
        'emails_per_hour' => 20,
        
        // Max API requests per minute per IP
        'api_per_minute' => 60,
        
        // Max webhook requests per minute (should match webhooks section)
        'webhook_per_minute' => 100,
        
        // Max failed login attempts before lockout
        'login_attempts' => 5,
        
        // How long to lock out after too many failed attempts (minutes)
        'lockout_minutes' => 15,
    ],

    // =========================================================================
    // SECTION 10: FILE UPLOADS
    // =========================================================================
    // Settings for email attachments and user uploads.
    // =========================================================================
    
    'uploads' => [
        // Where to store uploaded files (usually leave as default)
        'path' => __DIR__ . '/../uploads',
        
        // Maximum file size in MB
        'max_size_mb' => 25,
        
        // Allowed file types (MIME types)
        // Add or remove based on your needs
        'allowed_types' => [
            // Images
            'image/jpeg',
            'image/png', 
            'image/gif', 
            'image/webp',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            // Text files
            'text/plain', 
            'text/csv',
        ],
    ],
];

// ═══════════════════════════════════════════════════════════════════════════
// QUICK SETUP CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════
// 
// □ 1. Copy this file to config.php
// □ 2. Update database settings (Section 1)
// □ 3. Update app URL (Section 2)
// □ 4. Generate and set jwt_secret (Section 3)
// □ 5. Generate and set encryption_key (Section 3)
// □ 6. Update allowed_origins with your domain (Section 3)
// □ 7. Choose email delivery method:
//      - WEBHOOKS (Section 4): Faster, requires provider setup
//      - IMAP (Section 6): Easier, polls periodically
// □ 8. Set up SMTP for sending emails (Section 7)
// □ 9. (Optional) Set up Stripe for payments (Section 8)
//
// NEED HELP? See CPANEL-TUTORIAL.md for step-by-step instructions
// ═══════════════════════════════════════════════════════════════════════════

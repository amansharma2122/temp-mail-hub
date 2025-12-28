<?php
/**
 * IMAP Email Polling Script
 * Run via cron: */2 * * * * php /path/to/api/imap/poll.php
 * 
 * Fetches new emails from IMAP server and stores them
 */

// Prevent web access
if (php_sapi_name() !== 'cli' && !defined('IMAP_CRON_RUN')) {
    die('This script must be run from command line');
}

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/encryption.php';

$config = Database::getConfig();
$imapConfig = $config['imap'];

if (!$imapConfig['enabled']) {
    echo "IMAP is disabled in configuration\n";
    exit(0);
}

$startTime = microtime(true);
$processedCount = 0;
$errorCount = 0;

echo "[" . date('Y-m-d H:i:s') . "] Starting IMAP poll...\n";

try {
    // Build IMAP connection string
    $encryption = $imapConfig['encryption'] ?? 'ssl';
    $flags = '/imap';
    
    if ($encryption === 'ssl') {
        $flags .= '/ssl';
    } elseif ($encryption === 'tls') {
        $flags .= '/tls';
    }
    
    // Add novalidate-cert for self-signed certs (optional)
    $flags .= '/novalidate-cert';
    
    $mailbox = sprintf(
        '{%s:%d%s}%s',
        $imapConfig['host'],
        $imapConfig['port'],
        $flags,
        $imapConfig['folder'] ?? 'INBOX'
    );
    
    echo "Connecting to: {$imapConfig['host']}:{$imapConfig['port']}\n";
    
    // Connect to IMAP
    $imap = @imap_open(
        $mailbox,
        $imapConfig['username'],
        $imapConfig['password'],
        0,
        1 // Retry count
    );
    
    if (!$imap) {
        throw new Exception("IMAP connection failed: " . imap_last_error());
    }
    
    echo "Connected successfully\n";
    
    // Get unread emails
    $emails = imap_search($imap, 'UNSEEN');
    
    if (!$emails) {
        echo "No new emails found\n";
        imap_close($imap);
        exit(0);
    }
    
    $maxEmails = $imapConfig['max_emails_per_poll'] ?? 50;
    $emails = array_slice($emails, 0, $maxEmails);
    
    echo "Found " . count($emails) . " new email(s)\n";
    
    // Get all active temp emails for lookup
    $activeTempEmails = [];
    $tempEmailRows = Database::fetchAll(
        "SELECT te.id, te.email, te.expires_at 
         FROM temp_emails te 
         WHERE te.is_active = 1 AND te.expires_at > NOW()"
    );
    
    foreach ($tempEmailRows as $row) {
        $activeTempEmails[strtolower($row['email'])] = $row;
    }
    
    foreach ($emails as $emailNum) {
        try {
            $header = imap_headerinfo($imap, $emailNum);
            $structure = imap_fetchstructure($imap, $emailNum);
            
            // Get recipient email
            $toAddress = '';
            if (!empty($header->to)) {
                $to = $header->to[0];
                $toAddress = strtolower($to->mailbox . '@' . $to->host);
            }
            
            // Check if this email belongs to an active temp email
            if (!isset($activeTempEmails[$toAddress])) {
                echo "Skipping email to unknown address: {$toAddress}\n";
                // Mark as read to avoid reprocessing
                imap_setflag_full($imap, $emailNum, '\\Seen');
                continue;
            }
            
            $tempEmail = $activeTempEmails[$toAddress];
            
            // Parse sender
            $fromEmail = '';
            $fromName = '';
            if (!empty($header->from)) {
                $from = $header->from[0];
                $fromEmail = $from->mailbox . '@' . $from->host;
                $fromName = isset($from->personal) ? imap_utf8($from->personal) : '';
            }
            
            // Get subject
            $subject = isset($header->subject) ? imap_utf8($header->subject) : '(No Subject)';
            
            // Get body
            $bodyText = '';
            $bodyHtml = '';
            
            if (isset($structure->parts) && count($structure->parts) > 0) {
                // Multipart message
                foreach ($structure->parts as $partIndex => $part) {
                    $partBody = imap_fetchbody($imap, $emailNum, $partIndex + 1);
                    $partBody = decodeBody($partBody, $part->encoding);
                    
                    if ($part->subtype === 'PLAIN') {
                        $bodyText = $partBody;
                    } elseif ($part->subtype === 'HTML') {
                        $bodyHtml = $partBody;
                    }
                }
            } else {
                // Simple message
                $bodyText = imap_body($imap, $emailNum);
                $bodyText = decodeBody($bodyText, $structure->encoding ?? 0);
            }
            
            // Get message ID
            $messageId = isset($header->message_id) ? $header->message_id : Database::generateUUID();
            
            // Check for duplicate
            $existing = Database::fetchOne(
                "SELECT id FROM received_emails WHERE message_id = ?",
                [$messageId]
            );
            
            if ($existing) {
                echo "Skipping duplicate message: {$messageId}\n";
                imap_setflag_full($imap, $emailNum, '\\Seen');
                continue;
            }
            
            // Encrypt email content
            $encrypted = Encryption::encryptEmail([
                'subject' => $subject,
                'from_email' => $fromEmail,
                'from_name' => $fromName,
                'body_text' => $bodyText,
                'body_html' => $bodyHtml
            ]);
            
            // Store email
            $emailId = Database::insert('received_emails', [
                'id' => Database::generateUUID(),
                'temp_email_id' => $tempEmail['id'],
                'message_id' => $messageId,
                'from_email_encrypted' => $encrypted['from_email_encrypted'],
                'from_name_encrypted' => $encrypted['from_name_encrypted'] ?? null,
                'subject_encrypted' => $encrypted['subject_encrypted'],
                'body_text_encrypted' => $encrypted['body_text_encrypted'] ?? null,
                'body_html_encrypted' => $encrypted['body_html_encrypted'] ?? null,
                'is_encrypted' => 1,
                'is_read' => 0,
                'is_starred' => 0,
                'received_at' => date('Y-m-d H:i:s', strtotime($header->date ?? 'now')),
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            // Handle attachments
            if (isset($structure->parts)) {
                processImapAttachments($imap, $emailNum, $emailId, $structure->parts);
            }
            
            // Mark as read in IMAP
            imap_setflag_full($imap, $emailNum, '\\Seen');
            
            $processedCount++;
            echo "Processed email for: {$toAddress} (from: {$fromEmail})\n";
            
        } catch (Exception $e) {
            $errorCount++;
            error_log("Error processing email {$emailNum}: " . $e->getMessage());
            echo "Error processing email {$emailNum}: " . $e->getMessage() . "\n";
        }
    }
    
    // Update stats
    if ($processedCount > 0) {
        Database::query(
            "INSERT INTO email_stats (id, date, emails_received, created_at) 
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE emails_received = emails_received + ?",
            [Database::generateUUID(), date('Y-m-d'), $processedCount, $processedCount]
        );
    }
    
    imap_close($imap);
    
} catch (Exception $e) {
    error_log("IMAP poll error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}

$duration = round(microtime(true) - $startTime, 2);
echo "[" . date('Y-m-d H:i:s') . "] Completed: {$processedCount} processed, {$errorCount} errors, {$duration}s\n";

/**
 * Decode email body based on encoding
 */
function decodeBody(string $body, int $encoding): string {
    switch ($encoding) {
        case 0: // 7BIT
        case 1: // 8BIT
            return $body;
        case 2: // BINARY
            return $body;
        case 3: // BASE64
            return base64_decode($body);
        case 4: // QUOTED-PRINTABLE
            return quoted_printable_decode($body);
        default:
            return $body;
    }
}

/**
 * Process IMAP attachments
 */
function processImapAttachments($imap, int $emailNum, string $emailId, array $parts, string $partNumber = ''): void {
    $config = Database::getConfig();
    $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
    $maxSize = ($config['uploads']['max_size_mb'] ?? 25) * 1024 * 1024;
    
    foreach ($parts as $index => $part) {
        $currentPart = $partNumber ? $partNumber . '.' . ($index + 1) : ($index + 1);
        
        // Check if this part is an attachment
        $isAttachment = false;
        $filename = '';
        
        if (isset($part->disposition) && strtolower($part->disposition) === 'attachment') {
            $isAttachment = true;
        }
        
        // Get filename
        if (isset($part->dparameters)) {
            foreach ($part->dparameters as $param) {
                if (strtolower($param->attribute) === 'filename') {
                    $filename = imap_utf8($param->value);
                    $isAttachment = true;
                }
            }
        }
        
        if (!$filename && isset($part->parameters)) {
            foreach ($part->parameters as $param) {
                if (strtolower($param->attribute) === 'name') {
                    $filename = imap_utf8($param->value);
                    $isAttachment = true;
                }
            }
        }
        
        if ($isAttachment && $filename) {
            $body = imap_fetchbody($imap, $emailNum, $currentPart);
            $body = decodeBody($body, $part->encoding ?? 0);
            
            $size = strlen($body);
            if ($size > $maxSize) {
                continue;
            }
            
            $attachmentId = Database::generateUUID();
            $extension = pathinfo($filename, PATHINFO_EXTENSION);
            $storagePath = 'attachments/' . date('Y/m/d') . '/' . $attachmentId . '.' . $extension;
            $fullPath = $uploadPath . '/' . $storagePath;
            
            // Create directory
            $dir = dirname($fullPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            
            // Save file
            if (file_put_contents($fullPath, $body)) {
                $mimeType = mime_content_type($fullPath) ?: 'application/octet-stream';
                
                Database::insert('email_attachments', [
                    'id' => $attachmentId,
                    'email_id' => $emailId,
                    'filename' => $filename,
                    'mime_type' => $mimeType,
                    'size' => $size,
                    'storage_path' => $storagePath,
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            }
        }
        
        // Process nested parts
        if (isset($part->parts)) {
            processImapAttachments($imap, $emailNum, $emailId, $part->parts, $currentPart);
        }
    }
}

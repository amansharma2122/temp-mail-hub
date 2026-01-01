<?php
/**
 * SMTP Connection Test Script
 * Used by the installer to test SMTP settings before saving
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$host = trim($input['host'] ?? '');
$port = intval($input['port'] ?? 587);
$user = trim($input['user'] ?? '');
$pass = $input['pass'] ?? '';
$from = trim($input['from'] ?? $user);
$encryption = $input['encryption'] ?? 'tls';
$testEmail = $input['testEmail'] ?? ''; // Optional: send actual test email

if (empty($host) || empty($user)) {
    echo json_encode(['success' => false, 'error' => 'Host and username are required']);
    exit;
}

try {
    // Determine connection parameters
    $timeout = 10;
    $errno = 0;
    $errstr = '';
    
    // Build connection string
    if ($encryption === 'ssl' || $port == 465) {
        $socket = @fsockopen("ssl://$host", $port, $errno, $errstr, $timeout);
    } else {
        $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);
    }
    
    if (!$socket) {
        echo json_encode([
            'success' => false, 
            'error' => "Connection failed: $errstr ($errno)"
        ]);
        exit;
    }
    
    // Set socket timeout
    stream_set_timeout($socket, $timeout);
    
    // Read greeting
    $greeting = fgets($socket, 1024);
    if (substr($greeting, 0, 3) !== '220') {
        fclose($socket);
        echo json_encode([
            'success' => false, 
            'error' => "Invalid server greeting: $greeting"
        ]);
        exit;
    }
    
    // Send EHLO
    fputs($socket, "EHLO " . gethostname() . "\r\n");
    $response = '';
    while ($line = fgets($socket, 1024)) {
        $response .= $line;
        if (substr($line, 3, 1) === ' ') break;
    }
    
    // Start TLS if needed
    if ($encryption === 'tls' && $port != 465) {
        if (strpos($response, 'STARTTLS') !== false) {
            fputs($socket, "STARTTLS\r\n");
            $tlsResponse = fgets($socket, 1024);
            
            if (substr($tlsResponse, 0, 3) !== '220') {
                fclose($socket);
                echo json_encode([
                    'success' => false, 
                    'error' => "STARTTLS failed: $tlsResponse"
                ]);
                exit;
            }
            
            // Enable crypto
            $cryptoResult = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$cryptoResult) {
                fclose($socket);
                echo json_encode([
                    'success' => false, 
                    'error' => 'TLS encryption failed'
                ]);
                exit;
            }
            
            // Re-send EHLO after TLS
            fputs($socket, "EHLO " . gethostname() . "\r\n");
            while ($line = fgets($socket, 1024)) {
                if (substr($line, 3, 1) === ' ') break;
            }
        }
    }
    
    // Try authentication
    fputs($socket, "AUTH LOGIN\r\n");
    $authResponse = fgets($socket, 1024);
    
    if (substr($authResponse, 0, 3) !== '334') {
        // Try PLAIN auth
        fputs($socket, "AUTH PLAIN\r\n");
        $authResponse = fgets($socket, 1024);
        
        if (substr($authResponse, 0, 3) === '334') {
            $authString = base64_encode("\0" . $user . "\0" . $pass);
            fputs($socket, $authString . "\r\n");
            $authResult = fgets($socket, 1024);
        } else {
            fclose($socket);
            echo json_encode([
                'success' => false, 
                'error' => "Authentication not supported: $authResponse"
            ]);
            exit;
        }
    } else {
        // LOGIN auth
        fputs($socket, base64_encode($user) . "\r\n");
        fgets($socket, 1024); // 334 Password
        fputs($socket, base64_encode($pass) . "\r\n");
        $authResult = fgets($socket, 1024);
    }
    
    if (substr($authResult, 0, 3) !== '235') {
        fclose($socket);
        echo json_encode([
            'success' => false, 
            'error' => "Authentication failed: " . trim($authResult)
        ]);
        exit;
    }
    
    // If test email provided, send an actual test email
    $emailSent = false;
    if (!empty($testEmail) && filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
        // MAIL FROM
        fputs($socket, "MAIL FROM:<$from>\r\n");
        $mailResponse = fgets($socket, 1024);
        
        if (substr($mailResponse, 0, 3) === '250') {
            // RCPT TO
            fputs($socket, "RCPT TO:<$testEmail>\r\n");
            $rcptResponse = fgets($socket, 1024);
            
            if (substr($rcptResponse, 0, 3) === '250') {
                // DATA
                fputs($socket, "DATA\r\n");
                $dataResponse = fgets($socket, 1024);
                
                if (substr($dataResponse, 0, 3) === '354') {
                    $date = date('r');
                    $messageId = '<' . uniqid() . '@' . gethostname() . '>';
                    
                    $message = "From: TempMail <$from>\r\n";
                    $message .= "To: <$testEmail>\r\n";
                    $message .= "Subject: TempMail SMTP Test\r\n";
                    $message .= "Date: $date\r\n";
                    $message .= "Message-ID: $messageId\r\n";
                    $message .= "MIME-Version: 1.0\r\n";
                    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
                    $message .= "\r\n";
                    $message .= "This is a test email from TempMail installer.\r\n";
                    $message .= "If you received this, your SMTP configuration is working correctly!\r\n";
                    $message .= "\r\n";
                    $message .= "Sent at: $date\r\n";
                    $message .= ".\r\n";
                    
                    fputs($socket, $message);
                    $sendResponse = fgets($socket, 1024);
                    
                    if (substr($sendResponse, 0, 3) === '250') {
                        $emailSent = true;
                    }
                }
            }
        }
    }
    
    // QUIT
    fputs($socket, "QUIT\r\n");
    fclose($socket);
    
    $result = [
        'success' => true,
        'message' => 'SMTP authentication successful'
    ];
    
    if ($emailSent) {
        $result['message'] .= ". Test email sent to $testEmail";
        $result['emailSent'] = true;
    }
    
    echo json_encode($result);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

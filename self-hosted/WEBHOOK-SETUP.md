# Webhook Setup Guide

This guide explains how to configure instant email delivery using webhooks from various email providers.

## Supported Providers

- **Mailgun**
- **SendGrid**
- **Postmark**
- **Amazon SES**
- **ForwardEmail.net**
- **Custom/Generic** (any service that can POST email data)

## Webhook URL

Your webhook endpoint is:
```
https://yourdomain.com/api/emails/webhook.php
```

## Provider Setup

### Mailgun

1. Go to Mailgun Dashboard → Sending → Webhooks
2. Add new webhook:
   - URL: `https://yourdomain.com/api/emails/webhook.php`
   - Event: `inbound` (for receiving emails)
3. For inbound routing, go to Receiving → Routes
4. Create a route:
   - Expression: `match_recipient(".*@yourdomain.com")`
   - Action: Forward to `https://yourdomain.com/api/emails/webhook.php`

**Signature Verification:**
Add to your `config.php`:
```php
'webhook_secrets' => [
    'mailgun' => 'your-mailgun-api-key'
]
```

### SendGrid

1. Go to Settings → Inbound Parse
2. Add Host & URL:
   - Host: Your domain (e.g., `mail.yourdomain.com`)
   - URL: `https://yourdomain.com/api/emails/webhook.php`
3. Enable "POST the raw, full MIME message"

**Signature Verification:**
Add to your `config.php`:
```php
'webhook_secrets' => [
    'sendgrid' => 'your-sendgrid-webhook-signing-secret'
]
```

### Postmark

1. Go to Servers → Your Server → Inbound
2. Set webhook URL: `https://yourdomain.com/api/emails/webhook.php`
3. Configure the inbound domain

**Signature Verification:**
Add to your `config.php`:
```php
'webhook_secrets' => [
    'postmark' => 'your-postmark-server-token'
]
```

### Amazon SES

1. Create an SNS topic for email receiving
2. Subscribe your webhook URL to the SNS topic
3. Configure SES to publish to SNS

**Note:** Amazon SES requires confirming the SNS subscription.

### ForwardEmail.net

1. Go to your domain settings on ForwardEmail
2. Add a webhook:
   - URL: `https://yourdomain.com/api/emails/webhook.php`
3. Configure forwarding for your addresses

### Custom/Generic

For any other service that can POST emails:

1. Configure to POST to: `https://yourdomain.com/api/emails/webhook.php`
2. Add a secret header for verification:
   ```
   X-Webhook-Secret: your-custom-secret
   ```
3. Configure in `config.php`:
   ```php
   'webhook_secrets' => [
       'custom' => 'your-custom-secret'
   ]
   ```

## Expected Data Format

### JSON Format
```json
{
    "recipient": "user@yourdomain.com",
    "from": "sender@example.com",
    "from_name": "Sender Name",
    "subject": "Email Subject",
    "body_plain": "Plain text content",
    "body_html": "<p>HTML content</p>",
    "message_id": "unique-message-id",
    "attachments": []
}
```

### Form Data Format
```
recipient=user@yourdomain.com
from=sender@example.com
subject=Email Subject
body-plain=Plain text content
body-html=<p>HTML content</p>
```

## Testing

### Using cURL

```bash
# Test JSON webhook
curl -X POST https://yourdomain.com/api/emails/webhook.php \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "recipient": "test@yourdomain.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "body_plain": "This is a test email"
  }'
```

### Test Response

Success:
```json
{
    "success": true,
    "data": {
        "accepted": true,
        "email_id": "uuid-here"
    },
    "message": "Email received successfully"
}
```

Rejected (address not found):
```json
{
    "success": true,
    "data": {
        "accepted": false,
        "reason": "Address not found"
    }
}
```

## Webhook Logs

All webhook requests are logged to the `webhook_logs` table:

```sql
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 100;
```

## Rate Limiting

The webhook endpoint has built-in rate limiting:
- 100 requests per minute per IP address
- Returns 429 status when exceeded

## Real-Time Updates

When an email is received via webhook, it's immediately stored and a notification is created for real-time polling clients to pick up.

## Database Optimization

After setting up webhooks, run the optimization script:

```bash
mysql -u your_user -p your_database < database/optimize.sql
```

This adds:
- Performance indexes for faster queries
- Stored procedures for efficient inbox fetching
- Automatic cleanup events

## Troubleshooting

### Emails not arriving

1. Check webhook logs: `SELECT * FROM webhook_logs WHERE status != 'success'`
2. Verify the temp email address exists and is active
3. Check server error logs

### Signature verification failing

1. Ensure the secret is correctly set in `config.php`
2. Check the provider's documentation for the correct secret format
3. Temporarily disable verification to test:
   ```php
   'webhook_secrets' => [] // Empty array disables verification
   ```

### Slow performance

1. Run the database optimization script
2. Enable query caching in MySQL
3. Consider adding more memory to MySQL

## Security Best Practices

1. Always use HTTPS for webhook URLs
2. Configure webhook signature verification
3. Keep the webhook URL private
4. Monitor webhook logs for suspicious activity
5. Set up rate limiting at the web server level too

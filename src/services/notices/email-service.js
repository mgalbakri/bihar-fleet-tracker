// Email Service -- sends notice emails via SMTP or log-only mode
const { v4: uuidv4 } = require('uuid');

let db;
let config = {};

// Rate limiter: max 10 emails per minute
let emailsSentThisMinute = 0;
setInterval(() => { emailsSentThisMinute = 0; }, 60000);

function init(database, cfg) {
  db = database;
  config = cfg || {};

  // Run migration
  try {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', '..', 'db', 'migrations', '003-notice-system.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      db.exec(sql);
      console.log('[EMAIL] Migration 003 applied');
    }
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('[EMAIL] Migration error:', err.message);
    }
  }
}

/**
 * Send an email (or log it in dev mode)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML content
 * @param {string} textBody - Plain text fallback
 * @returns {{ success: boolean, messageId: string|null, error: string|null }}
 */
async function sendEmail(to, subject, htmlBody, textBody) {
  const provider = process.env.EMAIL_PROVIDER || 'none';

  if (emailsSentThisMinute >= 10) {
    return { success: false, messageId: null, error: 'Rate limit: max 10 emails per minute' };
  }

  if (provider === 'none') {
    // Development mode -- log only
    console.log(`[EMAIL] DEV MODE - Would send to: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body length: ${(htmlBody || '').length} chars`);
    emailsSentThisMinute++;
    return { success: true, messageId: 'dev-' + uuidv4().substring(0, 8), error: null };
  }

  if (provider === 'smtp') {
    return await sendViaSMTP(to, subject, htmlBody, textBody);
  }

  return { success: false, messageId: null, error: 'Unknown email provider: ' + provider };
}

async function sendViaSMTP(to, subject, htmlBody, textBody) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: (process.env.SMTP_PORT === '465'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'sentinel@bihar.com',
      to: to,
      subject: subject,
      html: htmlBody,
      text: textBody || subject
    });

    emailsSentThisMinute++;
    return { success: true, messageId: result.messageId, error: null };
  } catch (err) {
    return { success: false, messageId: null, error: err.message };
  }
}

/**
 * Queue an email delivery for a notice to a recipient
 */
function queueNoticeEmail(noticeId, recipientId, recipientEmail) {
  if (!db) return null;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO notice_deliveries (id, notice_id, recipient_id, recipient_email, status)
    VALUES (?, ?, ?, ?, 'QUEUED')
  `).run(id, noticeId, recipientId, recipientEmail);
  return { id, notice_id: noticeId, recipient_email: recipientEmail, status: 'QUEUED' };
}

/**
 * Process queued deliveries with retry logic
 */
async function processQueue() {
  if (!db) return { sent: 0, failed: 0 };

  const queued = db.prepare(`
    SELECT d.*, n.notice_content, n.notice_type, n.vessel_name
    FROM notice_deliveries d
    JOIN insurer_notices n ON d.notice_id = n.id
    WHERE d.status IN ('QUEUED', 'FAILED') AND d.attempt_count < 3
    ORDER BY d.notice_id ASC
    LIMIT 10
  `).all();

  let sent = 0;
  let failed = 0;

  for (const delivery of queued) {
    const subject = `BIHAR SENTINEL - ${delivery.notice_type} Notice: ${delivery.vessel_name}`;
    const result = await sendEmail(delivery.recipient_email, subject, delivery.notice_content, '');

    const now = new Date().toISOString();
    if (result.success) {
      db.prepare(`
        UPDATE notice_deliveries SET status = 'SENT', sent_at = ?, message_id = ?, attempt_count = attempt_count + 1, last_attempt_at = ?
        WHERE id = ?
      `).run(now, result.messageId, now, delivery.id);
      sent++;
    } else {
      db.prepare(`
        UPDATE notice_deliveries SET status = 'FAILED', error_message = ?, attempt_count = attempt_count + 1, last_attempt_at = ?
        WHERE id = ?
      `).run(result.error, now, delivery.id);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Get delivery status for a notice
 */
function getDeliveryStatus(noticeId) {
  if (!db) return [];
  return db.prepare('SELECT * FROM notice_deliveries WHERE notice_id = ? ORDER BY sent_at DESC').all(noticeId);
}

/**
 * Retry a failed delivery
 */
function retryFailed(deliveryId) {
  if (!db) return null;
  db.prepare("UPDATE notice_deliveries SET status = 'QUEUED', error_message = NULL WHERE id = ?").run(deliveryId);
  return db.prepare('SELECT * FROM notice_deliveries WHERE id = ?').get(deliveryId);
}

module.exports = { init, sendEmail, queueNoticeEmail, processQueue, getDeliveryStatus, retryFailed };

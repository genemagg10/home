/**
 * HomeBase — inbox forwarder (Google Apps Script)
 * --------------------------------------------------
 * Runs inside the lospalos@maggio.xyz Workspace mailbox and forwards new email
 * (and attachments) to HomeBase's /api/inbound-email webhook, which extracts the
 * details and files them into your review queue.
 *
 * SETUP
 * 1. Go to https://script.new (signed in as lospalos@maggio.xyz) and paste this in.
 * 2. Set the two values below: WEBHOOK_URL (your Vercel URL) and TOKEN (must match
 *    the INBOX_WEBHOOK_SECRET env var you set in Vercel — any long random string).
 * 3. Run `processInbox` once and approve the Gmail/UrlFetch permissions.
 * 4. Run `installTrigger` once to check the inbox automatically every 15 minutes.
 *
 * Anything that lands in this mailbox gets filed. Forward purchase confirmations,
 * quotes, receipts, manuals, etc. to lospalos@maggio.xyz.
 */

const WEBHOOK_URL = 'https://YOUR-APP.vercel.app/api/inbound-email';
const TOKEN = 'PASTE_THE_SAME_SECRET_AS_INBOX_WEBHOOK_SECRET';

const FILED_LABEL = 'HomeBaseFiled';
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // ~stay under the serverless body limit
const MAX_THREADS = 10; // per run

function processInbox() {
  const label = getOrCreateLabel_(FILED_LABEL);
  // Unprocessed mail = in the inbox and not yet labelled as filed.
  const threads = GmailApp.search('in:inbox -label:' + FILED_LABEL, 0, MAX_THREADS);

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const base = {
        from: msg.getFrom(),
        subject: msg.getSubject(),
        text: msg.getPlainBody().slice(0, 20000),
      };
      const attachments = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });

      if (attachments.length === 0) {
        post_(base); // body-only email
      } else {
        // One request per attachment keeps each POST small.
        attachments.forEach(function (att) {
          if (att.getSize() > MAX_ATTACHMENT_BYTES) {
            post_(Object.assign({}, base, {
              text: base.text + '\n\n[Attachment "' + att.getName() + '" was too large to forward automatically.]',
            }));
            return;
          }
          post_(Object.assign({}, base, {
            attachments: [{
              filename: att.getName(),
              contentType: att.getContentType(),
              dataBase64: Utilities.base64Encode(att.getBytes()),
            }],
          }));
        });
      }
    });
    thread.addLabel(label);
    thread.markRead();
  });
}

function post_(payload) {
  const res = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-inbox-token': TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    Logger.log('Webhook error ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(15).create();
}

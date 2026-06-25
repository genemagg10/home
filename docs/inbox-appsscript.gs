/**
 * HomeBase — inbox forwarder (Google Apps Script)
 * ==================================================
 * Runs inside the lospalos@maggio.xyz Workspace mailbox and forwards new email
 * (and attachments) to HomeBase's /api/inbound-email webhook, which extracts the
 * details and files them into your review queue.
 *
 * Anything that lands in this mailbox gets filed. Forward purchase confirmations,
 * quotes, receipts, manuals, etc. to lospalos@maggio.xyz.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * FULL SETUP WALKTHROUGH
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Order matters: do the Vercel env var FIRST (step 0), since this script calls
 * your live site.
 *
 * 0. VERCEL (once):
 *    - Project → Settings → Environment Variables → add INBOX_WEBHOOK_SECRET set
 *      to any long random string. (Optional: INBOX_ALLOWED_SENDERS = your email.)
 *    - Redeploy so the new variable is live.
 *
 * 1. OPEN A NEW APPS SCRIPT PROJECT:
 *    - Sign into Google AS lospalos@maggio.xyz (check the avatar, top-right). This
 *      matters — the script can only read the mailbox of the account that owns it.
 *    - In that tab, go to https://script.new and hit enter.
 *    - A page titled "Untitled project" opens. The big middle area (showing
 *      `function myFunction() {}`) is the code editor — that's where everything goes.
 *
 * 2. PASTE THIS FILE IN:
 *    - Click in the editor, Select All (Ctrl/Cmd+A), Delete the starter text.
 *    - Copy this ENTIRE file and paste it into the empty editor.
 *
 * 3. EDIT EXACTLY TWO LINES (just below this comment):
 *    - WEBHOOK_URL → your real Vercel address + /api/inbound-email,
 *      e.g. 'https://home-xxxx.vercel.app/api/inbound-email'
 *    - TOKEN → the SAME string you used for INBOX_WEBHOOK_SECRET in Vercel.
 *    Keep the single quotes and semicolons.
 *
 * 4. SAVE:
 *    - Click the floppy-disk 💾 icon (or Ctrl/Cmd+S). Name it "HomeBase Inbox".
 *
 * 5. RUN ONCE TO GRANT PERMISSION:
 *    - In the toolbar function dropdown, select `processInbox`, click ▶ Run.
 *    - "Authorization required" → Review permissions → pick lospalos@maggio.xyz.
 *    - "Google hasn't verified this app" (expected for your own script) →
 *      Advanced → Go to HomeBase Inbox (unsafe) → Allow. (It's your own code
 *      reading your own mailbox.)
 *    - Check the Execution log at the bottom — no red errors means it worked.
 *
 * 6. TURN ON THE 15-MINUTE SCHEDULE:
 *    - Switch the dropdown to `installTrigger`, click ▶ Run (no new prompt).
 *    - Verify under the ⏰ Triggers icon in the far-left sidebar: one trigger
 *      calling processInbox on a time interval.
 *
 * TO TEST IMMEDIATELY: select `processInbox` and hit ▶ Run, then check the
 * review queue on your site.
 *
 * TROUBLESHOOTING (from the Execution log):
 *    - 401  → TOKEN here ≠ INBOX_WEBHOOK_SECRET in Vercel.
 *    - 503  → the Vercel env var hasn't deployed yet (redeploy / wait).
 *    - 403  → INBOX_ALLOWED_SENDERS is set and the sender didn't match.
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

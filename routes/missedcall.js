// Twilio Voice webhook for missed calls.
//
// Wiring in the Twilio console (Phone number → Voice configuration):
//   Option A (status callback): set the CALL STATUS CHANGES webhook to
//     https://<host>/missed-call — we act on no-answer/busy/failed.
//   Option B (voice webhook): point "A call comes in" here — we play a
//     polite message and follow up on WhatsApp immediately.

const express = require('express');
const { handleMissedCall } = require('../lib/missedcall');
const { BUSINESS_NAME } = require('../config/business');

const router = express.Router();

// Statuses that count as a missed call when used as a status callback.
const MISSED_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);

router.post('/', (req, res) => {
  const from = ((req.body && req.body.From) || '').replace(/^whatsapp:/, '').trim();
  const callStatus = ((req.body && req.body.CallStatus) || '').toLowerCase();

  // Polite TwiML either way (harmless for status callbacks, spoken if used
  // as the primary voice webhook).
  res
    .type('text/xml')
    .send(
      `<Response><Say voice="alice">Thank you for calling ${BUSINESS_NAME}. ` +
        `We are sending you a WhatsApp message right now to arrange everything. Goodbye.</Say></Response>`
    );

  if (!from) {
    console.warn('[missed-call] Ignoring payload without From');
    return;
  }
  // If Twilio told us the status, only act on genuinely missed calls.
  if (callStatus && !MISSED_STATUSES.has(callStatus)) {
    console.log(`[missed-call] Ignoring CallStatus=${callStatus} for ${from}`);
    return;
  }

  console.log(`[missed-call] Missed call from ${from} (status=${callStatus || 'n/a'})`);
  handleMissedCall(from).catch((err) =>
    console.error('[missed-call] Pipeline error:', err)
  );
});

module.exports = router;

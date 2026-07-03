// Twilio WhatsApp helpers.
// Sandbox today, real number later: only TWILIO_WHATSAPP_NUMBER changes.
// When Twilio creds are absent (local dev / simulator) sends become
// console logs instead of failing.

const twilio = require('twilio');

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('[twilio] Client initialised');
  } catch (err) {
    console.error('[twilio] Failed to init client:', err.message);
  }
} else {
  console.log('[twilio] Credentials not set — outbound messages will be logged, not sent');
}

/** Normalise any phone value to the "whatsapp:+91..." form Twilio expects. */
function toWhatsApp(number) {
  const n = String(number).trim();
  return n.startsWith('whatsapp:') ? n : `whatsapp:${n}`;
}

// WhatsApp messages cap at 1600 chars — split long messages on paragraph
// boundaries so nothing is silently rejected.
function chunk(body, size = 1500) {
  if (body.length <= size) return [body];
  const parts = [];
  let rest = body;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n\n', size);
    if (cut < size / 2) cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = rest.lastIndexOf(' ', size);
    if (cut < size / 2) cut = size;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Send a WhatsApp message. Never throws — returns true on success.
 * @param {string} to   customer number ("+91..." or "whatsapp:+91...")
 * @param {string} body message text
 */
async function sendWhatsApp(to, body) {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!client || !from) {
    console.log(`[twilio] (dry-run) → ${to}:\n${body}\n`);
    return true;
  }
  try {
    for (const part of chunk(body)) {
      await client.messages.create({
        from: toWhatsApp(from),
        to: toWhatsApp(to),
        body: part,
      });
    }
    return true;
  } catch (err) {
    console.error(`[twilio] Send to ${to} failed:`, err.message);
    return false;
  }
}

module.exports = { sendWhatsApp, toWhatsApp };

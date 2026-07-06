// Missed-call follow-up: when a customer's call to the business goes
// unanswered, we proactively open a WhatsApp conversation so the concierge
// can capture the lead. Triggered by the Twilio Voice status callback
// (routes: POST /missed-call).

const store = require('./store');
const { sendWhatsApp } = require('./twilio');
const { BUSINESS_NAME, CONTACT } = require('../config/business');

const FOLLOW_UP_MESSAGE =
  `Hello! You just called ${BUSINESS_NAME} — so sorry we missed you. ✨ ` +
  `I'm your personal concierge for Mumbai's finest chauffeur-driven luxury cars ` +
  `(Bentley, Maybach, Range Rover and more). ` +
  `Tell me the occasion — a wedding, an airport transfer, something special — ` +
  `and I'll arrange everything right here. Or call us back any time on ${CONTACT.phone}.`;

/**
 * Handle one missed call. Creates/updates the conversation with
 * source = "missed_call_followup", seeds the outbound follow-up into the
 * history (so the AI has context when they reply), registers a lead, and
 * sends the WhatsApp follow-up. Never throws.
 *
 * @param {string} phone caller number, e.g. "+919876543210"
 * @returns {Promise<boolean>} true if the pipeline completed
 */
async function handleMissedCall(phone) {
  try {
    const conversation = await store.getConversation(phone);
    const alreadyActive = (conversation.messages || []).length > 0;
    const now = new Date().toISOString();

    await store.saveConversation(phone, {
      messages: [
        ...(conversation.messages || []),
        { role: 'assistant', content: FOLLOW_UP_MESSAGE, ts: now },
      ],
      stage: conversation.stage || 'new',
      lead_data: conversation.lead_data || {},
      language: conversation.language || 'en',
      source: alreadyActive ? conversation.source || 'whatsapp' : 'missed_call_followup',
    });
    await store.upsertLead(phone, {
      ...(conversation.lead_data || {}),
      status: conversation.lead_data?.status || 'new',
    });

    console.log(`[missed-call] Conversation recorded for ${phone} (source=missed_call_followup)`);
    const sent = await sendWhatsApp(phone, FOLLOW_UP_MESSAGE);
    console.log(`[missed-call] WhatsApp follow-up ${sent ? 'dispatched' : 'FAILED'} for ${phone}`);
    return true;
  } catch (err) {
    console.error(`[missed-call] Failed for ${phone}:`, err);
    return false;
  }
}

module.exports = { handleMissedCall, FOLLOW_UP_MESSAGE };

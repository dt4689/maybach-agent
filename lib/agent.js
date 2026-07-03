// The Anthropic conversation engine.
// One entry point: handleMessage(phone, text) → reply string (always).
// It never throws — on any internal failure the customer still gets a
// graceful, on-brand reply and the error is logged with context.

const Anthropic = require('@anthropic-ai/sdk');
const { AI_MODEL, BUSINESS_NAME, CONTACT } = require('../config/business');
const { buildSystemPrompt } = require('./prompt');
const sheets = require('./sheets');
const store = require('./store');
const ratelimit = require('./ratelimit');
const { notifyOwner } = require('./alerts');

// Lazy client: the server must boot (and /health must answer) even before
// ANTHROPIC_API_KEY is configured.
let anthropic = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return anthropic;
}

const MAX_HISTORY_MESSAGES = 40; // keep the last N turns in context
const LEAD_RE = /<lead>([\s\S]*?)<\/lead>/;

const FALLBACK_REPLY =
  `My apologies — I'm having a brief technical moment. ✨ Please give me a minute and try again, ` +
  `or call our team directly on ${CONTACT.phone} and we'll take beautiful care of you.`;

const THROTTLE_REPLY =
  `You're quick! ✨ Give me just a moment to catch up — I'll be right with you. ` +
  `For anything urgent, our team is on ${CONTACT.phone}.`;

/** Build the availability context injected into the system prompt. */
function buildAvailabilityNote(availability, leadData) {
  if (!availability) {
    return (
      '- Live availability is NOT connected yet. You cannot see which cars are free on any date. ' +
      'Capture the lead and promise the team will confirm availability shortly.'
    );
  }
  const date = leadData?.booking_date;
  const rows = availability.filter((r) => !date || String(r.date).includes(String(date)));
  if (rows.length === 0) {
    return (
      '- Live availability sheet is connected but has no entries for the requested date. ' +
      'Treat availability as unconfirmed: capture the lead and say the team will confirm shortly.'
    );
  }
  const lines = rows
    .slice(0, 40)
    .map((r) => `  - ${r.vehicle} on ${r.date}: ${String(r.status).toUpperCase()}`)
    .join('\n');
  return (
    '- Live availability (from our booking sheet):\n' +
    lines +
    '\n- A vehicle marked BOOKED must never be promised for that date — offer an equally prestigious alternative. ' +
    'Vehicles marked AVAILABLE may be offered confidently.'
  );
}

/** Parse and strip the hidden <lead> JSON block from the model reply. */
function extractLead(rawReply) {
  let lead = null;
  const match = rawReply.match(LEAD_RE);
  if (match) {
    try {
      lead = JSON.parse(match[1]);
    } catch (err) {
      console.error('[agent] Failed to parse <lead> JSON:', err.message, '| raw:', match[1].slice(0, 300));
    }
  }
  const text = rawReply.replace(LEAD_RE, '').trim();
  return { text, lead };
}

/** Merge new lead fields over the previous ones (nulls never erase known data). */
function mergeLead(prev = {}, next = {}) {
  const merged = { ...prev };
  for (const [key, value] of Object.entries(next)) {
    if (value !== null && value !== undefined && value !== '') merged[key] = value;
  }
  // Status only moves forward (new → qualified → confirmed); "lost" wins any time.
  const rank = { new: 0, qualified: 1, confirmed: 2 };
  if (next.status === 'lost') merged.status = 'lost';
  else if ((rank[next.status] ?? -1) < (rank[prev.status] ?? 0)) merged.status = prev.status;
  return merged;
}

/**
 * Handle one inbound WhatsApp message.
 * @param {string} phone customer number, e.g. "+919876543210"
 * @param {string} text  message body
 * @returns {Promise<string>} the reply to send back — never throws
 */
async function handleMessage(phone, text) {
  try {
    if (!ratelimit.allow(phone)) {
      console.warn(`[agent] Rate limit hit for ${phone}`);
      return THROTTLE_REPLY;
    }

    const conversation = await store.getConversation(phone);
    const history = (conversation.messages || []).slice(-MAX_HISTORY_MESSAGES);

    // Live business data (each falls back gracefully inside lib/sheets.js).
    const fleet = await sheets.getFleet();
    const availability = await sheets.getAvailability();

    const system = buildSystemPrompt({
      fleet,
      availabilityNote: buildAvailabilityNote(availability, conversation.lead_data),
    });

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    let rawReply;
    try {
      const response = await getAnthropic().messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      });
      rawReply = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
    } catch (err) {
      console.error(`[agent] Anthropic call failed for ${phone}:`, err.message);
      return FALLBACK_REPLY;
    }

    if (!rawReply) {
      console.error(`[agent] Empty model reply for ${phone}`);
      return FALLBACK_REPLY;
    }

    const { text: reply, lead } = extractLead(rawReply);
    const prevLead = conversation.lead_data || {};
    const mergedLead = lead ? mergeLead(prevLead, lead) : prevLead;
    const stage = mergedLead.status || 'new';

    // Persist conversation + lead (both fail soft inside lib/store.js).
    const now = new Date().toISOString();
    await store.saveConversation(phone, {
      messages: [
        ...history,
        { role: 'user', content: text, ts: now },
        { role: 'assistant', content: reply, ts: now },
      ],
      stage,
      lead_data: mergedLead,
      language: mergedLead.language || conversation.language || 'en',
    });
    await store.upsertLead(phone, mergedLead);

    // Owner alert on the moment a lead becomes qualified or confirmed.
    const prevStatus = prevLead.status || 'new';
    if (['qualified', 'confirmed'].includes(stage) && stage !== prevStatus) {
      notifyOwner(phone, mergedLead).catch((err) =>
        console.error('[agent] Owner alert failed:', err.message)
      );
    }

    return reply || FALLBACK_REPLY;
  } catch (err) {
    console.error(`[agent] Unexpected failure handling message from ${phone}:`, err);
    return FALLBACK_REPLY;
  }
}

module.exports = { handleMessage, extractLead, mergeLead, buildAvailabilityNote };

#!/usr/bin/env node
// Preflight check for the two external services that matter most.
//
//   npm run check                       → verify Anthropic key + model, Twilio creds
//   npm run check -- --send +91XXXXXXXXXX → also send a real WhatsApp test message
//
// Prints exact error codes and what they usually mean. Never prints secrets.

require('dotenv').config();

const args = process.argv.slice(2);
const sendIdx = args.indexOf('--send');
const sendTo = sendIdx >= 0 ? args[sendIdx + 1] : null;

const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`\x1b[31m✖\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`);
const hint = (m) => console.log(`   → ${m}`);
let failures = 0;

const mask = (v) => (v ? `${String(v).slice(0, 4)}…(${String(v).length} chars)` : 'MISSING');

const TWILIO_HINTS = {
  20003: 'Auth failed: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN wrong or rotated. Copy both again from the Twilio Console home.',
  63007: 'Sender is not a WhatsApp-enabled channel. TWILIO_WHATSAPP_NUMBER must be the sandbox number (whatsapp:+14155238886) or an approved WhatsApp sender.',
  63015: 'Recipient has not joined the sandbox. From that phone, WhatsApp the "join <two-words>" code shown in Twilio → Messaging → Try it out → WhatsApp sandbox.',
  63016: 'Outside the 24-hour window: WhatsApp only allows free-form messages within 24h of the customer\'s last message. Use an approved template, or have the recipient message you first.',
  63018: 'WhatsApp rate limit hit — slow down.',
  63024: 'Invalid recipient number format. Use full E.164, e.g. +919812345678.',
  21608: 'Trial account: can only message numbers verified in the Twilio Console. Verify the number or upgrade the account.',
  21211: 'Invalid "To" phone number.',
  21659: 'The From number is not a valid Twilio number/sender.',
};

async function checkEnv() {
  console.log('\n── Environment ─────────────────────────────');
  const { AI_MODEL } = require('../config/business');
  const vars = ['ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];
  for (const v of vars) {
    if (process.env[v]) ok(`${v} = ${mask(process.env[v])}`);
    else { bad(`${v} is not set`); failures++; }
  }
  console.log(`   AI_MODEL resolves to: ${AI_MODEL}`);
  console.log(`   OWNER_WHATSAPP: ${process.env.OWNER_WHATSAPP || '(default +919892904433)'}`);
  const num = process.env.TWILIO_WHATSAPP_NUMBER || '';
  if (num && !/^(whatsapp:)?\+\d{8,15}$/.test(num.trim())) {
    bad(`TWILIO_WHATSAPP_NUMBER "${num}" is not E.164 (expected e.g. whatsapp:+14155238886)`);
    failures++;
  }
  if (num.replace('whatsapp:', '') === '+14155238886') {
    warn('Using the Twilio SANDBOX number — only phones that joined the sandbox can chat, and joins expire after 72h.');
  }
}

async function checkAnthropic() {
  console.log('\n── Anthropic (Claude API) ──────────────────');
  if (!process.env.ANTHROPIC_API_KEY) { bad('skipped — no ANTHROPIC_API_KEY'); return; }
  const Anthropic = require('@anthropic-ai/sdk');
  const { AI_MODEL } = require('../config/business');
  const client = new Anthropic();
  const started = Date.now();
  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: 'Reply with exactly the word: READY' }],
    });
    const ms = Date.now() - started;
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    ok(`Model "${AI_MODEL}" responded in ${ms}ms → "${text}"`);
    console.log(`   served by: ${res.model} | stop_reason: ${res.stop_reason} | tokens in/out: ${res.usage.input_tokens}/${res.usage.output_tokens}`);
    const types = res.content.map((b) => b.type);
    if (types.includes('thinking')) {
      warn('Model returned thinking blocks. Thinking tokens count against max_tokens (1024 in lib/agent.js) — watch for truncated replies.');
    }
    if (res.stop_reason === 'max_tokens') {
      warn('stop_reason=max_tokens on a trivial prompt — max_tokens is too low for this model. Raise it in lib/agent.js.');
    }
  } catch (err) {
    failures++;
    bad(`Anthropic call failed: HTTP ${err.status || '?'} — ${err.message}`);
    if (err.status === 401) hint('API key invalid/revoked. Create a new one at console.anthropic.com → API Keys.');
    else if (err.status === 404) hint(`Model "${AI_MODEL}" not found for this key. Check the exact ID / your account's model access.`);
    else if (err.status === 400 && /credit|balance/i.test(err.message)) hint('Out of credits. Add billing at console.anthropic.com → Plans & Billing.');
    else if (err.status === 429) hint('Rate limited or over quota.');
    else if (!err.status) hint('Network problem reaching api.anthropic.com.');
  }
}

async function checkTwilio() {
  console.log('\n── Twilio ──────────────────────────────────');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) { bad('skipped — missing Twilio credentials'); return; }
  const twilio = require('twilio');
  const client = twilio(sid, token);

  try {
    const account = await client.api.accounts(sid).fetch();
    ok(`Authenticated. Account "${account.friendlyName}" — status: ${account.status}, type: ${account.type}`);
    if (account.type === 'Trial') warn('TRIAL account: can only message verified numbers, and messages carry a trial prefix.');
    if (account.status !== 'active') { bad(`Account status is "${account.status}"`); failures++; }
  } catch (err) {
    failures++;
    bad(`Twilio auth failed: [${err.code || err.status}] ${err.message}`);
    if (TWILIO_HINTS[err.code]) hint(TWILIO_HINTS[err.code]);
    return;
  }

  if (!sendTo) {
    console.log('   (add  -- --send +91XXXXXXXXXX  to send a real WhatsApp test message)');
    return;
  }
  const wa = (n) => (String(n).startsWith('whatsapp:') ? String(n) : `whatsapp:${String(n).trim()}`);
  try {
    const msg = await client.messages.create({
      from: wa(process.env.TWILIO_WHATSAPP_NUMBER),
      to: wa(sendTo),
      body: 'Maybach Rentals preflight check ✔ — if you can read this, outbound WhatsApp works.',
    });
    ok(`Message queued: ${msg.sid} (status: ${msg.status}). Check the phone; delivery failures show in Twilio Console → Monitor → Logs → Messaging.`);
  } catch (err) {
    failures++;
    bad(`Send failed: [${err.code}] ${err.message}`);
    if (TWILIO_HINTS[err.code]) hint(TWILIO_HINTS[err.code]);
  }
}

(async () => {
  await checkEnv();
  await checkAnthropic();
  await checkTwilio();
  console.log(failures ? `\n\x1b[31m${failures} problem(s) found.\x1b[0m\n` : '\n\x1b[32mAll checks passed.\x1b[0m\n');
  process.exit(failures ? 1 : 0);
})();

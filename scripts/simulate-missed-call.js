#!/usr/bin/env node
// Missed-call follow-up simulator.
// Runs the REAL missed-call pipeline (store + WhatsApp send) with the
// in-memory store when Supabase env vars are blank, and a dry-run Twilio
// send when Twilio creds are absent.
//
// Usage: node scripts/simulate-missed-call.js [+91XXXXXXXXXX]

require('dotenv').config();

async function main() {
  const phone = process.argv[2] || '+919800022233';

  const { handleMissedCall } = require('../lib/missedcall');
  const store = require('../lib/store');

  const line = '─'.repeat(64);
  console.log(`\n${line}\n  SIMULATION: MISSED CALL from ${phone}\n${line}\n`);

  const ok = await handleMissedCall(phone);

  const conversation = await store.getConversation(phone);
  const lead = await store.getLead(phone);

  console.log('\nRESULTS');
  console.log('  pipeline completed :', ok);
  console.log('  conversation source:', conversation.source);
  console.log('  messages seeded    :', (conversation.messages || []).length);
  console.log('  first message role :', conversation.messages?.[0]?.role);
  console.log('  lead record        :', JSON.stringify(lead));

  if (conversation.source !== 'missed_call_followup') {
    console.error('\n❌ FAIL: source was not marked missed_call_followup');
    process.exit(1);
  }
  console.log('\n✅ PASS: conversation stored with source=missed_call_followup and follow-up send attempted.');
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});

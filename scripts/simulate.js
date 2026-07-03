#!/usr/bin/env node
// End-to-end conversation simulator.
// Runs the REAL agent pipeline (real Anthropic API, real prompt, real lead
// extraction, in-memory store, dry-run Twilio) and prints the transcript —
// including the owner alert, which appears as a "[twilio] (dry-run)" log.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... npm run simulate wedding
//   ANTHROPIC_API_KEY=sk-... npm run simulate airport
//   npm run simulate wedding "custom first message" "second message" ...

require('dotenv').config();

const SCENARIOS = {
  wedding: [
    'hi',
    "It's my wedding next month and I want a really special car for the baraat entry",
    '14 Feb, morning around 8am. Pickup from Juhu. It will just be me and my father in the car',
    'The Bentley sounds amazing. How much would that be?',
    'Can you decorate it with flowers?',
    "Great, let's do it. I'm Rohan Mehta, rohan.mehta@example.com",
    'Yes please confirm the booking!',
  ],
  airport: [
    'Hello, I need a car for airport pickup',
    'Terminal 2 international, this Friday 11pm. We are 5 people with luggage, going to Powai',
    'What does the Vellfire cost?',
    'Ok book it. Name is Priya Nair, email priya.nair@example.com',
  ],
};

async function main() {
  const args = process.argv.slice(2);
  const scenarioName = args[0] || 'wedding';
  const customMessages = args.slice(1);
  const messages =
    customMessages.length > 0 ? customMessages : SCENARIOS[scenarioName];

  if (!messages) {
    console.error(`Unknown scenario "${scenarioName}". Use: wedding | airport`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the simulation.');
    process.exit(1);
  }

  // Require AFTER dotenv so lib modules see the env.
  const agent = require('../lib/agent');
  const store = require('../lib/store');

  const phone = '+919800011122'; // fake customer number
  const line = '─'.repeat(64);

  console.log(`\n${line}\n  SIMULATION: ${scenarioName.toUpperCase()} ENQUIRY  (customer ${phone})\n${line}\n`);

  for (const text of messages) {
    console.log(`👤 CUSTOMER: ${text}\n`);
    const reply = await agent.handleMessage(phone, text);
    console.log(`🤵 CONCIERGE: ${reply}\n`);
    console.log(line + '\n');
  }

  const lead = await store.getLead(phone);
  console.log('FINAL CAPTURED LEAD:');
  console.log(JSON.stringify(lead, null, 2));
  console.log(
    '\n(The owner alert above appears as a "[twilio] (dry-run)" block when Twilio creds are absent.)'
  );
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});

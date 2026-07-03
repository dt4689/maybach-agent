// Twilio WhatsApp webhook.
// POST: inbound customer message → run the agent → reply via the REST API.
// We ACK Twilio immediately with empty TwiML and send the reply
// asynchronously, so slow AI turns never hit Twilio's webhook timeout.

const express = require('express');
const agent = require('../lib/agent');
const { sendWhatsApp } = require('../lib/twilio');

const router = express.Router();

// GET /webhook — lets Twilio (and humans) verify the URL is alive.
router.get('/', (req, res) => {
  res.status(200).send('Maybach Rentals WhatsApp agent webhook is live.');
});

// POST /webhook — inbound WhatsApp message from Twilio.
router.post('/', (req, res) => {
  // ACK instantly with empty TwiML; the reply goes out via the REST API.
  res.type('text/xml').send('<Response></Response>');

  const from = (req.body && req.body.From) || ''; // "whatsapp:+91..."
  const body = ((req.body && req.body.Body) || '').trim();
  if (!from || !body) {
    console.warn('[webhook] Ignoring payload without From/Body');
    return;
  }
  const phone = from.replace(/^whatsapp:/, '');
  console.log(`[webhook] ${phone}: ${body.slice(0, 200)}`);

  // Fire-and-forget; agent.handleMessage never throws.
  agent
    .handleMessage(phone, body)
    .then((reply) => sendWhatsApp(phone, reply))
    .catch((err) => console.error('[webhook] Unexpected pipeline error:', err));
});

module.exports = router;

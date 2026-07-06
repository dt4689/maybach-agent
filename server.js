// Maybach Rentals WhatsApp AI booking agent — Express server.

require('dotenv').config(); // loads .env locally; on Railway, vars come from the platform

// ── Startup env validation ───────────────────────────────────────────
// Fail fast with a clear message instead of a confusing stack trace when
// the first customer message arrives.
const RED = '\x1b[31m%s\x1b[0m';
const YELLOW = '\x1b[33m%s\x1b[0m';

const REQUIRED_VARS = [
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
];
const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
if (missing.length > 0) {
  for (const name of missing) {
    console.error(RED, `✖ FATAL: required environment variable ${name} is not set.`);
  }
  console.error(
    RED,
    `Refusing to start. Set the variable${missing.length > 1 ? 's' : ''} above in .env (local) or the Railway Variables tab, then restart.`
  );
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(YELLOW, '⚠ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using in-memory store (data lost on restart).');
}
if (!process.env.ADMIN_PASSWORD) {
  console.warn(YELLOW, '⚠ ADMIN_PASSWORD not set — the /admin dashboard is disabled.');
}
// ─────────────────────────────────────────────────────────────────────

const express = require('express');
const { version } = require('./package.json');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const missedCallRouter = require('./routes/missedcall');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded
app.use(express.json());

app.use('/webhook', webhookRouter);
app.use('/missed-call', missedCallRouter);
app.use('/admin', adminRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Maybach Rentals agent listening on :${port}`);
});

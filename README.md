# Maybach Rentals — WhatsApp AI Booking Concierge

A production WhatsApp AI booking agent for **Maybach Rentals** (luxury chauffeur-driven
car rentals, Mumbai · Navi Mumbai · Thane). Node.js + Express, deployable to Railway.

- **AI**: Anthropic API (model isolated in one constant — `AI_MODEL`)
- **Messaging**: Twilio WhatsApp API (sandbox today → real number later, env-only switch)
- **Persistence**: Supabase (Postgres) — falls back to in-memory storage if not configured
- **Fleet & availability**: Google Sheets (read) — falls back to the hardcoded fleet
- **Admin**: password-protected dark-luxury lead dashboard at `/admin`
- **Alerts**: WhatsApp summary to the owner when a lead becomes qualified/confirmed

## Architecture

```
WhatsApp customer
      │
      ▼
Twilio WhatsApp API ──POST──► /webhook (Express)
                                 │
                                 ├─ lib/ratelimit.js   (10 msgs/min per number)
                                 ├─ lib/store.js       (Supabase or in-memory)
                                 ├─ lib/sheets.js      (Fleet + Availability tabs, fallback)
                                 ├─ lib/prompt.js      (the luxury-concierge system prompt)
                                 ├─ lib/agent.js       (Anthropic conversation engine)
                                 ├─ lib/alerts.js      (owner WhatsApp alert)
                                 └─ lib/twilio.js      (send reply)
```

Every external call (Twilio, Anthropic, Supabase, Sheets) is wrapped in try/catch —
a single bad message never crashes the agent; the customer always gets a graceful reply.

## Project layout

```
config/business.js       ← ALL editable business data: brand name, fleet, prices, copy, AI_MODEL
lib/prompt.js            ← the agent personality (edit freely, no logic here)
lib/agent.js             ← Anthropic conversation engine + lead extraction
lib/sheets.js            ← Google Sheets reader (Fleet + Availability) with fallback
lib/twilio.js            ← WhatsApp send helper
lib/store.js             ← Supabase persistence (in-memory fallback)
lib/alerts.js            ← owner lead alerts
lib/ratelimit.js         ← per-number throttling
routes/webhook.js        ← POST/GET /webhook
routes/admin.js          ← GET /admin (+ /admin/api/leads)
server.js                ← Express app, /health
supabase/migrations/     ← SQL migration
scripts/simulate.js      ← end-to-end conversation simulator (no Twilio needed)
```

## Setup

### 1. Install

```bash
npm install
cp .env.example .env    # then fill in values
```

Minimum to test locally: `ANTHROPIC_API_KEY`. Everything else degrades gracefully
(in-memory store, hardcoded fleet, no-op Twilio sends that log to console).

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/migrations/001_init.sql`.
3. Copy **Project URL** → `SUPABASE_URL` and **service_role key** (Settings → API)
   → `SUPABASE_SERVICE_ROLE_KEY`.

RLS is enabled on both tables; the server uses the service role key, which bypasses RLS.
Never expose the service role key to a browser.

### 3. Google Sheets (optional — fallback works without it)

<!-- TODO(dhruv): share the real Sheet ID + confirm tab structure -->

1. Create a Google Cloud service account, enable the **Google Sheets API**,
   download the JSON key.
2. Paste the JSON (single line) into `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Share the sheet (Viewer) with the service account's email.
4. Put the sheet ID (from its URL) in `GOOGLE_SHEETS_ID`.

Expected tabs:

| Tab | Columns |
|---|---|
| `Fleet` | name, model, category, colour, capacity_pax, package_price, package_terms, status |
| `Availability` | vehicle, date (YYYY-MM-DD), status (`booked` / `available`) |

### 4. Twilio WhatsApp **Sandbox** — test on your own WhatsApp today

1. Sign up / log in at [twilio.com](https://www.twilio.com), copy **Account SID**
   and **Auth Token** (Console home) into `.env`.
2. Console → **Messaging → Try it out → Send a WhatsApp message**.
3. You'll see the sandbox number (usually `+1 415 523 8886`) and a join code like
   `join golden-hour`. From **your own WhatsApp**, send that join code to the
   sandbox number. You're now connected to the sandbox.
4. Set in `.env`: `TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886`
5. Run the server and expose it publicly:
   ```bash
   npm start
   # in another terminal (or deploy to Railway first):
   npx ngrok http 3000
   ```
6. In the sandbox settings page, set **"When a message comes in"** to
   `https://<your-url>/webhook` (method **POST**). Save.
7. WhatsApp "hi" to the sandbox number — the concierge replies. 🥂

### 5. Switching to Maybach's real number (later)

Apply for WhatsApp Business API sender approval on the real number in the Twilio
console, then change **only**:

```
TWILIO_WHATSAPP_NUMBER=whatsapp:+919892904433
```

No code changes.

### 6. Deploy to Railway

1. Push this repo to GitHub, then in [Railway](https://railway.app):
   **New Project → Deploy from GitHub repo**.
2. Add all env vars from `.env.example` in the Railway **Variables** tab.
3. Railway auto-detects Node and uses `railway.json` / `Procfile` (`node server.js`).
4. Copy the public Railway URL and set the Twilio webhook to
   `https://<railway-url>/webhook`.

## Test the agent without WhatsApp

```bash
npm run simulate wedding   # full wedding-booking conversation transcript
npm run simulate airport   # airport-transfer conversation transcript
```

Uses the real Anthropic API + real agent code with an in-memory store and console
"owner alerts" — no Twilio or Supabase needed.

## Editing business data (non-developers)

Everything a human might want to tune lives in two files:

- **`config/business.js`** — brand name (`BUSINESS_NAME`), model name (`AI_MODEL`
  fallback), the full fleet + prices, decoration price, advance policy wording,
  contact details.
- **`lib/prompt.js`** — the agent's personality and conversation rules, in plain
  English.

## Endpoints

| Route | Description |
|---|---|
| `POST /webhook` | Inbound WhatsApp from Twilio → runs agent → replies |
| `GET /webhook` | Twilio URL verification (returns 200) |
| `GET /admin` | Password-protected lead dashboard (Basic auth, user `admin`) |
| `GET /health` | `{ "status": "ok", "version": "..." }` |

// Password-protected admin lead dashboard.
// GET /admin           → dark-luxury HTML dashboard (auto-refreshes every 30s)
// GET /admin/api/leads → JSON of today's leads (same auth)
// Auth: HTTP Basic — username "admin", password = env ADMIN_PASSWORD.

const express = require('express');
const crypto = require('crypto');
const store = require('../lib/store');
const { BUSINESS_NAME } = require('../config/business');

const router = express.Router();

function timingSafeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res
      .status(503)
      .send('Admin dashboard disabled: set ADMIN_PASSWORD in the environment.');
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    try {
      const [, password] = Buffer.from(header.slice(6), 'base64').toString().split(':');
      if (password && timingSafeEqual(password, expected)) return next();
    } catch (err) {
      console.error('[admin] Auth parse error:', err.message);
    }
  }
  res.set('WWW-Authenticate', `Basic realm="${BUSINESS_NAME} Admin"`);
  res.status(401).send('Authentication required.');
}

/** Mask a phone number: +919876543210 → +91XXXXXX3210 */
function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 7) return 'XXXX';
  return p.slice(0, 3) + 'X'.repeat(Math.max(0, p.length - 7)) + p.slice(-4);
}

router.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const leads = await store.getTodaysLeads();
    res.json(
      leads.map((l) => ({
        phone: maskPhone(l.phone_number),
        name: l.name || '—',
        occasion: l.occasion || '—',
        vehicle: l.vehicle || '—',
        quote: l.quoted_total ? `₹${Number(l.quoted_total).toLocaleString('en-IN')}` : '—',
        status: l.status || 'new',
        last_message: l.updated_at,
      }))
    );
  } catch (err) {
    console.error('[admin] /api/leads failed:', err.message);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/', requireAuth, (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${BUSINESS_NAME} — Leads</title>
<style>
  :root {
    --bg: #0c0c0f; --panel: #141419; --line: #26262e;
    --gold: #c9a227; --gold-soft: #e6c766; --text: #ece9e2; --dim: #8d8a82;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font: 15px/1.6 Georgia, 'Times New Roman', serif; min-height: 100vh; }
  header { padding: 36px 40px 24px; border-bottom: 1px solid var(--line);
           background: radial-gradient(1200px 300px at 20% -50%, rgba(201,162,39,.14), transparent); }
  h1 { font-size: 26px; font-weight: normal; letter-spacing: .12em; text-transform: uppercase; }
  h1 .accent { color: var(--gold); }
  header p { color: var(--dim); margin-top: 6px; font-style: italic; }
  main { padding: 32px 40px; max-width: 1200px; margin: 0 auto; }
  .meta { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; color: var(--dim); font-size: 13px; }
  .meta .dot { color: var(--gold); }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 14px 18px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
       color: var(--gold); border-bottom: 1px solid var(--line); font-weight: normal; }
  td { padding: 14px 18px; border-bottom: 1px solid var(--line); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(201,162,39,.05); }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px;
           letter-spacing: .12em; text-transform: uppercase; border: 1px solid; }
  .badge.new       { color: #9aa4b2; border-color: #3a3f47; }
  .badge.qualified { color: var(--gold-soft); border-color: var(--gold); }
  .badge.confirmed { color: #7ed3a0; border-color: #2c6e49; }
  .badge.lost      { color: #d38b8b; border-color: #6e2c2c; }
  .empty { padding: 56px; text-align: center; color: var(--dim); font-style: italic; }
  footer { text-align: center; padding: 28px; color: var(--dim); font-size: 12px; letter-spacing: .08em; }
</style>
</head>
<body>
<header>
  <h1>${BUSINESS_NAME.replace(/ /g, '&nbsp;')} <span class="accent">·</span> Lead Desk</h1>
  <p>Today's enquiries, refreshed live every 30 seconds</p>
</header>
<main>
  <div class="meta">
    <span id="count">Loading…</span>
    <span>Last updated <span class="dot">●</span> <span id="updated">—</span></span>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Phone</th><th>Name</th><th>Occasion</th><th>Vehicle</th>
          <th>Quote</th><th>Status</th><th>Last message</th>
        </tr>
      </thead>
      <tbody id="rows"><tr><td colspan="7" class="empty">Loading leads…</td></tr></tbody>
    </table>
  </div>
</main>
<footer>${BUSINESS_NAME} — chauffeur-driven luxury, Mumbai · Navi Mumbai · Thane</footer>
<script>
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function refresh() {
    try {
      const res = await fetch('/admin/api/leads');
      if (!res.ok) throw new Error(res.status);
      const leads = await res.json();
      document.getElementById('count').textContent =
        leads.length + ' lead' + (leads.length === 1 ? '' : 's') + ' today';
      document.getElementById('updated').textContent = new Date().toLocaleTimeString();
      const rows = document.getElementById('rows');
      if (!leads.length) {
        rows.innerHTML = '<tr><td colspan="7" class="empty">No leads yet today — the concierge is standing by. 🥂</td></tr>';
        return;
      }
      rows.innerHTML = leads.map((l) => \`
        <tr>
          <td>\${esc(l.phone)}</td>
          <td>\${esc(l.name)}</td>
          <td>\${esc(l.occasion)}</td>
          <td>\${esc(l.vehicle)}</td>
          <td>\${esc(l.quote)}</td>
          <td><span class="badge \${esc(l.status)}">\${esc(l.status)}</span></td>
          <td>\${l.last_message ? new Date(l.last_message).toLocaleTimeString() : '—'}</td>
        </tr>\`).join('');
    } catch (err) {
      document.getElementById('count').textContent = 'Failed to load — retrying…';
    }
  }
  refresh();
  setInterval(refresh, 30000);
</script>
</body>
</html>`);
});

module.exports = router;

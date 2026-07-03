// Google Sheets reader for live fleet + availability.
// Two tabs are expected:
//   "Fleet"        → name | model | category | colour | capacity_pax | package_price | package_terms | status
//   "Availability" → vehicle | date (YYYY-MM-DD) | status (booked/available)
//
// If GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_JSON are absent or any call
// fails, we fall back to the hardcoded fleet in config/business.js and
// treat availability as "confirm with team" (getAvailability → null).
//
// TODO(dhruv): supply the real Sheet ID + confirm the tab/column structure.

const { google } = require('googleapis');
const { FLEET, POLICIES } = require('../config/business');

const CACHE_TTL_MS = 60 * 1000; // re-read the sheet at most once a minute
const cache = { fleet: null, fleetAt: 0, availability: null, availabilityAt: 0 };

let sheetsClient = null;

function getClient() {
  if (sheetsClient) return sheetsClient;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const rawCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !rawCreds) return null;
  try {
    const creds = JSON.parse(rawCreds);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('[sheets] Google Sheets connected');
    return sheetsClient;
  } catch (err) {
    console.error('[sheets] Invalid GOOGLE_SERVICE_ACCOUNT_JSON, using fallback fleet:', err.message);
    return null;
  }
}

async function readTab(tabName) {
  const client = getClient();
  if (!client) return null;
  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `${tabName}!A1:Z1000`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] !== undefined ? String(row[i]).trim() : '']))
    );
  } catch (err) {
    console.error(`[sheets] Failed to read tab "${tabName}":`, err.message);
    return null;
  }
}

/**
 * The current fleet. Live sheet when connected, otherwise the hardcoded
 * fallback from config/business.js. Always returns a non-empty array.
 */
async function getFleet() {
  const now = Date.now();
  if (cache.fleet && now - cache.fleetAt < CACHE_TTL_MS) return cache.fleet;

  const rows = await readTab('Fleet');
  if (rows && rows.length > 0) {
    const fleet = rows
      .filter((r) => r.name)
      .map((r) => ({
        name: r.name,
        model: r.model || '',
        category: r.category || 'Luxury Vehicle',
        colour: r.colour || r.color || '',
        capacity_pax: parseInt(r.capacity_pax, 10) || 4,
        package_price: parseInt(String(r.package_price).replace(/[^0-9]/g, ''), 10) || 0,
        package_terms: r.package_terms || POLICIES.packageTerms,
        status: (r.status || 'available').toLowerCase(),
      }))
      .filter((v) => v.package_price > 0);
    if (fleet.length > 0) {
      cache.fleet = fleet;
      cache.fleetAt = now;
      return fleet;
    }
  }
  return FLEET; // hardcoded fallback
}

/**
 * Availability rows: [{vehicle, date, status}], or null when the sheet is
 * not connected/readable — in which case the agent must never promise a car.
 */
async function getAvailability() {
  const now = Date.now();
  if (cache.availability && now - cache.availabilityAt < CACHE_TTL_MS) return cache.availability;

  const rows = await readTab('Availability');
  if (!rows) return null;
  const availability = rows
    .filter((r) => r.vehicle && r.date)
    .map((r) => ({
      vehicle: r.vehicle,
      date: r.date,
      status: (r.status || 'available').toLowerCase(),
    }));
  cache.availability = availability;
  cache.availabilityAt = now;
  return availability;
}

module.exports = { getFleet, getAvailability };

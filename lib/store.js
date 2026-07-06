// Persistence layer: Supabase (Postgres) when configured, otherwise an
// in-memory fallback so the agent works out-of-the-box in the sandbox.
// Server-side only — uses the service role key (bypasses RLS).

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    console.log('[store] Supabase persistence enabled');
  } catch (err) {
    console.error('[store] Failed to init Supabase, falling back to memory:', err.message);
  }
} else {
  console.log('[store] SUPABASE_URL not set — using in-memory store (fine for sandbox testing)');
}

// ── in-memory fallback ───────────────────────────────────────────────
const memConversations = new Map(); // phone → conversation row
const memLeads = new Map(); // phone → lead row

const emptyConversation = (phone) => ({
  phone_number: phone,
  messages: [],
  stage: 'new',
  lead_data: {},
  language: 'en',
  source: 'whatsapp', // 'whatsapp' | 'missed_call_followup'
  updated_at: new Date().toISOString(),
});

async function getConversation(phone) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('phone_number', phone)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (err) {
      console.error('[store] getConversation failed:', err.message);
    }
  }
  return memConversations.get(phone) || emptyConversation(phone);
}

async function saveConversation(phone, { messages, stage, lead_data, language, source }) {
  const row = {
    phone_number: phone,
    messages,
    stage,
    lead_data,
    language,
    source: source || 'whatsapp',
    updated_at: new Date().toISOString(),
  };
  memConversations.set(phone, row); // keep memory copy as a safety net
  if (supabase) {
    try {
      const { error } = await supabase
        .from('conversations')
        .upsert(row, { onConflict: 'phone_number' });
      if (error) throw error;
    } catch (err) {
      console.error('[store] saveConversation failed:', err.message);
    }
  }
}

async function getLead(phone) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('phone_number', phone)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (err) {
      console.error('[store] getLead failed:', err.message);
    }
  }
  return memLeads.get(phone) || null;
}

async function upsertLead(phone, lead) {
  const row = {
    phone_number: phone,
    name: lead.name ?? null,
    email: lead.email ?? null,
    occasion: lead.occasion ?? null,
    vehicle: lead.vehicle ?? null,
    booking_date: lead.booking_date ?? null,
    duration_hours: Number.isFinite(lead.duration_hours) ? lead.duration_hours : null,
    pickup_location: lead.pickup_location ?? null,
    quoted_total: Number.isFinite(lead.quoted_total) ? lead.quoted_total : null,
    status: lead.status || 'new',
    updated_at: new Date().toISOString(),
  };
  const existing = memLeads.get(phone);
  memLeads.set(phone, { ...(existing || { created_at: row.updated_at }), ...row });
  if (supabase) {
    try {
      const { error } = await supabase.from('leads').upsert(row, { onConflict: 'phone_number' });
      if (error) throw error;
    } catch (err) {
      console.error('[store] upsertLead failed:', err.message);
    }
  }
}

/** Leads created or updated today (for the admin dashboard), newest first. */
async function getTodaysLeads() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .gte('updated_at', startOfDay.toISOString())
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[store] getTodaysLeads failed:', err.message);
    }
  }
  return [...memLeads.values()]
    .filter((l) => new Date(l.updated_at) >= startOfDay)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

module.exports = { getConversation, saveConversation, getLead, upsertLead, getTodaysLeads };

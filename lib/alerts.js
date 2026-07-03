// Owner lead alerts: when a lead becomes QUALIFIED or CONFIRMED, WhatsApp
// a crisp summary to the owner number (env OWNER_WHATSAPP).

const { sendWhatsApp } = require('./twilio');
const { BUSINESS_NAME } = require('../config/business');

const DEFAULT_OWNER = '+919892904433';

function fmt(value, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

/**
 * Send the owner a lead summary. Never throws.
 * @param {string} customerPhone e.g. "+919876543210"
 * @param {object} lead merged lead data
 */
async function notifyOwner(customerPhone, lead) {
  try {
    const owner = process.env.OWNER_WHATSAPP || DEFAULT_OWNER;
    const status = (lead.status || 'qualified').toUpperCase();
    const quoted = Number.isFinite(lead.quoted_total)
      ? `₹${Number(lead.quoted_total).toLocaleString('en-IN')} (8 Hrs / 80 Km package)`
      : '—';

    const body =
      `🔔 ${status} LEAD — ${BUSINESS_NAME}\n\n` +
      `👤 Name: ${fmt(lead.name)}\n` +
      `🎉 Occasion: ${fmt(lead.occasion)}\n` +
      `📅 Date: ${fmt(lead.booking_date)}\n` +
      `🚘 Vehicle: ${fmt(lead.vehicle)}\n` +
      `⏱ Duration: ${fmt(lead.duration_hours, '8')} hrs\n` +
      `📍 Pickup: ${fmt(lead.pickup_location)}\n` +
      `💰 Quoted: ${quoted}\n` +
      `📧 Email: ${fmt(lead.email)}\n` +
      `📱 Customer: ${customerPhone}\n\n` +
      (status === 'CONFIRMED'
        ? 'Customer has CONFIRMED — reach out to finalise and collect the advance.'
        : 'Fully qualified — follow up to close.');

    await sendWhatsApp(owner, body);
    console.log(`[alerts] Owner notified (${status}) for ${customerPhone}`);
  } catch (err) {
    console.error('[alerts] notifyOwner failed:', err.message);
  }
}

module.exports = { notifyOwner };

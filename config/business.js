// ═══════════════════════════════════════════════════════════════════
// ALL EDITABLE BUSINESS DATA LIVES HERE.
// Non-developers: you can safely change any value in this file.
// ═══════════════════════════════════════════════════════════════════

// TODO(dhruv): confirm the customer-facing brand name — website header
// says "Sunvenus Luxury Car Rental Mumbai" but vehicles are watermarked
// maybachrental.com. Default until confirmed:
const BUSINESS_NAME = 'Maybach Rentals';

// PLACEHOLDER model — swap to a Fable/Mythos model string later by
// changing AI_MODEL in the environment (or the fallback below).
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

const CONTACT = {
  phone: '+91 9892904433',
  office:
    '66 1st Floor, Om Heera Panna Mall, Andheri Link Rd, Andheri West, Mumbai 400053',
  serviceAreas: ['Mumbai', 'Navi Mumbai', 'Thane'],
  rating: '4.8 stars, 170+ Google reviews, 7000+ happy customers',
};

const POLICIES = {
  chauffeurOnly: true, // NO self-drive, ever. All cars come with a professional chauffeur.
  packageTerms: '8 Hrs / 80 Km', // every price below is for this fixed package
  // Extra hours / extra kilometres are charged additionally and confirmed
  // by the team. TODO(dhruv): supply real extra-hr / extra-km rates.
  extrasNote:
    'Additional hours and kilometres are charged extra and confirmed by our team.',
  advancePolicy:
    'Advance payments are non-refundable, but the full amount is retained as credit toward any future booking within 6 months.',
  doorstepDelivery: 'Doorstep delivery of vehicles is available across Mumbai.',
  decorationPrice: 2500, // PLACEHOLDER — TODO(dhruv): confirm floral decoration price
};

// ── FLEET (hardcoded fallback; live data comes from the Google Sheet) ──
// All prices are per 8 Hrs / 80 Km package, INR. All vehicles 5.0 rated.
// TODO(dhruv): full 40+ vehicle catalogue + offers come from the Google Sheet.
const FLEET = [
  { name: 'Bentley Flying Spur',    model: 'W12',      category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 20000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Mercedes Maybach S600',  model: 'S600',     category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Mercedes Maybach GLS600',model: 'GLS600',   category: 'Luxury SUV',     colour: 'White', capacity_pax: 6, package_price: 15000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Maybach Original S600',  model: 'S600',     category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 15000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Maybach V600 Limousine', model: 'V600',     category: 'Limousine',      colour: 'Black', capacity_pax: 5, package_price: 20000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'New Shape Merc E-Class', model: 'E-Class',  category: 'Luxury Sedan',   colour: 'Black', capacity_pax: 4, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'New Shape Merc E-Class', model: 'E-Class',  category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Mercedes AMG E63',       model: 'E63',      category: 'Convertible',    colour: 'White', capacity_pax: 3, package_price: 15000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Range Rover Vogue',      model: 'Vogue',    category: 'Luxury SUV',     colour: 'Black', capacity_pax: 4, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Range Rover Vogue',      model: 'Vogue',    category: 'Luxury SUV',     colour: 'White', capacity_pax: 4, package_price: 15000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'New Shape BMW M5',       model: 'M5',       category: 'Luxury Sedan',   colour: 'Red',   capacity_pax: 4, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'New Shape BMW M5',       model: 'M5',       category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Latest Shape BMW 740D',  model: '740D',     category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Audi A8L',               model: 'A8L',      category: 'Luxury Sedan',   colour: 'Black', capacity_pax: 3, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Audi A8L',               model: 'A8L',      category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Audi Q7 SUV VIP',        model: 'Q7',       category: 'Luxury SUV',     colour: 'Red',   capacity_pax: 6, package_price: 7000,  package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Audi Q7 SUV VIP',        model: 'Q7',       category: 'Luxury SUV',     colour: 'White', capacity_pax: 5, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Toyota Vellfire',        model: 'Vellfire', category: 'Luxury Minivan', colour: 'White', capacity_pax: 6, package_price: 25000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Toyota Vellfire',        model: 'Vellfire', category: 'Luxury Minivan', colour: 'Black', capacity_pax: 6, package_price: 25000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'Range Rover Defender',   model: 'Defender', category: 'Luxury SUV',     colour: 'White', capacity_pax: 6, package_price: 25000, package_terms: '8 Hrs / 80 Km', status: 'available' },
  { name: 'New Shape BMW 7 Series', model: '7 Series', category: 'Luxury Sedan',   colour: 'White', capacity_pax: 4, package_price: 12000, package_terms: '8 Hrs / 80 Km', status: 'available' },
];

// Recommendation shortlists by occasion (names must match FLEET names).
const RECOMMENDATIONS = {
  wedding: ['Bentley Flying Spur', 'Mercedes Maybach GLS600', 'Mercedes Maybach S600'],
  airport_small: ['New Shape Merc E-Class', 'Audi A8L', 'New Shape BMW 7 Series'],
  airport_group: ['Toyota Vellfire', 'Audi Q7 SUV VIP', 'Mercedes Maybach GLS600'],
  corporate: ['Audi A8L', 'Latest Shape BMW 740D', 'Mercedes Maybach S600'],
  photoshoot: ['Mercedes AMG E63', 'New Shape BMW M5', 'Range Rover Vogue'],
};

module.exports = { BUSINESS_NAME, AI_MODEL, CONTACT, POLICIES, FLEET, RECOMMENDATIONS };

import express, { Request, Response } from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ============================================================
// In-Memory Data Models & Seed Data
// ============================================================

interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: "household" | "provider";
  phone: string;
  address: string;
  created_at: string;
}

interface Household {
  id: number;
  user_id: number;
  home_type: string;
  size_sqft: number;
  occupants: number;
  location: string;
  monthly_budget: number;
  solar_available: boolean;
  created_at: string;
}

interface Provider {
  id: number;
  user_id: number;
  business_name: string;
  categories: string;
  experience_years: number;
  location: string;
  base_price: string;
  description: string;
  availability_status: string;
  rating: number;
  verified: boolean;
  created_at: string;
}

interface Appliance {
  id: number;
  household_id: number;
  name: string;
  category: string;
  quantity: number;
  power_rating_watts: number;
  usage_hours_per_day: number;
  created_at: string;
}

interface HouseholdBill {
  id: number;
  household_id: number;
  amount: number;
  units: number;
  billing_period: string;
  tariff_rate: number;
  fixed_charges: number;
  taxes: number;
  other_charges: number;
  discom: string;
  source: string;
  updated_at: string;
}

interface EnergyReading {
  id: number;
  household_id: number;
  date: string;
  kwh: number;
  source: string;
  notes: string;
  created_at: string;
}

interface ServiceRequest {
  id: number;
  user_id: number;
  provider_id: number;
  service_type: string;
  description: string;
  requested_date: string;
  address: string;
  status: string;
  created_at: string;
}

interface ChatMessage {
  id: number;
  conversation_id: number;
  user_id: number;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(user: User): string {
  const payload = JSON.stringify({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  });
  return Buffer.from(payload).toString("base64url");
}

let nextUserId = 5;
let nextHouseholdId = 2;
let nextProviderId = 30;
let nextApplianceId = 4;
let nextReadingId = 24;
let nextBillId = 2;
let nextServiceRequestId = 3;
let nextChatId = 1;

const users: User[] = [
  {
    id: 1,
    email: "household@example.com",
    password_hash: hashPassword("password123"),
    full_name: "Alex Sharma",
    role: "household",
    phone: "+91 9876543210",
    address: "Flat 402, Green Meadows, Mumbai",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    email: "provider@example.com",
    password_hash: hashPassword("password123"),
    full_name: "Rajesh Kumar",
    role: "provider",
    phone: "+91 9811223344",
    address: "Shop 14, High Street, Mumbai",
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    email: "sparky@example.com",
    password_hash: hashPassword("password123"),
    full_name: "Vikram Singh",
    role: "provider",
    phone: "+91 9822334455",
    address: "Sector 18, Connaught Place, Delhi",
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    email: "solar@example.com",
    password_hash: hashPassword("password123"),
    full_name: "Pooja Mehta",
    role: "provider",
    phone: "+91 9833445566",
    address: "FC Road, Shivajinagar, Pune",
    created_at: new Date().toISOString(),
  },
];

const households: Household[] = [
  {
    id: 1,
    user_id: 1,
    home_type: "Apartment",
    size_sqft: 1250,
    occupants: 4,
    location: "Mumbai",
    monthly_budget: 3500.0,
    solar_available: false,
    created_at: new Date().toISOString(),
  },
];

const providers: Provider[] = [
  {
    id: 1,
    user_id: 2,
    business_name: "CoolAir Solutions",
    categories: "AC Service, HVAC Maintenance",
    experience_years: 12,
    location: "Mumbai",
    base_price: "₹500 - ₹2000",
    description: "Certified AC servicing, inverter compressor checks, and chemical coil washing.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    user_id: 3,
    business_name: "Sparky Electricals",
    categories: "Electrical Maintenance, Smart Meters",
    experience_years: 8,
    location: "Delhi NCR",
    base_price: "₹300 - ₹1500",
    description: "Residential rewiring, smart energy sub-meter installation, and MCB earthing.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    user_id: 4,
    business_name: "SolarEdge Systems",
    categories: "Solar Installation, Net Metering",
    experience_years: 15,
    location: "Pune",
    base_price: "Contact for Quote",
    description: "MNRE-subsidized rooftop solar PV installations, net-metering approvals, and annual AMC.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    user_id: 2,
    business_name: "Silicon City Solar Tech",
    categories: "Solar Installation, Battery Storage",
    experience_years: 10,
    location: "Bengaluru",
    base_price: "Contact for Quote",
    description: "On-grid and hybrid rooftop solar setup with BESCOM net-metering processing.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    user_id: 3,
    business_name: "GreenGrid Energy Audits",
    categories: "Energy Audit, Smart Meters",
    experience_years: 7,
    location: "Bengaluru",
    base_price: "₹1200 - ₹3500",
    description: "BEE-certified home energy audits, thermal imaging leakage checks, and harmonic analysis.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 6,
    user_id: 4,
    business_name: "Deccan Solar Works",
    categories: "Solar Installation, Net Metering",
    experience_years: 11,
    location: "Hyderabad",
    base_price: "Contact for Quote",
    description: "Tier-1 mono PERC rooftop solar panels with TSSPDCL net-metering integration.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 7,
    user_id: 2,
    business_name: "TelanVolt Electricals",
    categories: "Electrical Maintenance, Appliance Repair",
    experience_years: 9,
    location: "Hyderabad",
    base_price: "₹400 - ₹1800",
    description: "Switchgear replacement, inverter wiring, and energy-efficient BLDC fan installations.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 8,
    user_id: 3,
    business_name: "Coromandel Solar Energy",
    categories: "Solar Installation, Net Metering",
    experience_years: 14,
    location: "Chennai",
    base_price: "Contact for Quote",
    description: "Specialists in coastal corrosion-resistant rooftop solar structures and TANGEDCO subsidies.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 9,
    user_id: 4,
    business_name: "Madras Watts & Wire",
    categories: "Electrical Maintenance, Earthing",
    experience_years: 13,
    location: "Chennai",
    base_price: "₹350 - ₹1600",
    description: "Residential 3-phase load balancing, lightning surge arresters, and earth pit testing.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 10,
    user_id: 2,
    business_name: "MahaUrja Solar Dynamics",
    categories: "Solar Installation, Energy Audit",
    experience_years: 16,
    location: "Mumbai",
    base_price: "Contact for Quote",
    description: "Turnkey residential solar systems, Adani/MSEDCL rooftop sanctioning, and 25-yr panel warranty.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 11,
    user_id: 3,
    business_name: "SuryaGujarat Solar Systems",
    categories: "Solar Installation, Net Metering",
    experience_years: 12,
    location: "Ahmedabad",
    base_price: "Contact for Quote",
    description: "Gujarat's top PM Surya Ghar installer. Fast-track DISCOM meter replacement & subsidy claims.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 12,
    user_id: 4,
    business_name: "Sabarmati ElectroCare",
    categories: "Electrical Maintenance, Inverter Setup",
    experience_years: 8,
    location: "Ahmedabad",
    base_price: "₹400 - ₹1500",
    description: "Solar inverter pairing, tubular battery servicing, and distribution board overhauls.",
    availability_status: "Available",
    rating: 4.6,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 13,
    user_id: 2,
    business_name: "Bengal SunPower Dynamics",
    categories: "Solar Installation, Net Metering",
    experience_years: 9,
    location: "Kolkata",
    base_price: "Contact for Quote",
    description: "Rooftop solar PV solutions tailored for WBSEDCL & CESC consumers in Greater Kolkata.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 14,
    user_id: 3,
    business_name: "Hooghly Electrical Services",
    categories: "Electrical Maintenance, AC Service",
    experience_years: 11,
    location: "Kolkata",
    base_price: "₹350 - ₹1800",
    description: "Old building wiring upgrades, anti-short-circuit breaker setups, and AC servicing.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 15,
    user_id: 4,
    business_name: "Desert Sun Solar Power",
    categories: "Solar Installation, Battery Storage",
    experience_years: 13,
    location: "Jaipur",
    base_price: "Contact for Quote",
    description: "High-irradiance solar power setups with automated dust cleaning sprinkler systems.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 16,
    user_id: 2,
    business_name: "PinkCity Cooling & HVAC",
    categories: "AC Service, Appliance Repair",
    experience_years: 10,
    location: "Jaipur",
    base_price: "₹450 - ₹2200",
    description: "Heat-load optimized inverter AC repair, duct sanitization, and gas leak detection.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 17,
    user_id: 3,
    business_name: "Awadh Solar Energy Hub",
    categories: "Solar Installation, Net Metering",
    experience_years: 8,
    location: "Lucknow",
    base_price: "Contact for Quote",
    description: "UPPCL net-metering solar rooftop plants with direct portal subsidy filing.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 18,
    user_id: 4,
    business_name: "Malabar Green Energy",
    categories: "Solar Installation, Battery Storage",
    experience_years: 11,
    location: "Kochi",
    base_price: "Contact for Quote",
    description: "Monsoon-proof rooftop solar PV, hybrid battery inverters, and KSEB grid synchronization.",
    availability_status: "Available",
    rating: 4.9,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 19,
    user_id: 2,
    business_name: "Shivalik Solar & Renewables",
    categories: "Solar Installation, Energy Audit",
    experience_years: 14,
    location: "Chandigarh",
    base_price: "Contact for Quote",
    description: "Residential solar EPC contractor covering Tri-city (Chandigarh, Mohali, Panchkula).",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 20,
    user_id: 3,
    business_name: "Malwa Solar Innovations",
    categories: "Solar Installation, Net Metering",
    experience_years: 9,
    location: "Indore",
    base_price: "Contact for Quote",
    description: "Central India's trusted residential solar integrator. Quick MPPKVVCL net meter sync.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 21,
    user_id: 4,
    business_name: "Brahmaputra Clean Energy",
    categories: "Solar Installation, Inverter Setup",
    experience_years: 7,
    location: "Guwahati",
    base_price: "Contact for Quote",
    description: "Hybrid solar setups with heavy-duty backup batteries for uninterrupted green power.",
    availability_status: "Available",
    rating: 4.7,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 22,
    user_id: 2,
    business_name: "Kalinga Solar Power Tech",
    categories: "Solar Installation, Net Metering",
    experience_years: 10,
    location: "Bhubaneswar",
    base_price: "Contact for Quote",
    description: "Heavy-duty cyclone rated mounting structures and TPCODL net metering approvals.",
    availability_status: "Available",
    rating: 4.8,
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 23,
    user_id: 3,
    business_name: "Magadh Surya Urja",
    categories: "Solar Installation, Electrical Maintenance",
    experience_years: 8,
    location: "Patna",
    base_price: "Contact for Quote",
    description: "Affordable residential solar and home rewiring services across Patna and Danapur.",
    availability_status: "Available",
    rating: 4.6,
    verified: true,
    created_at: new Date().toISOString(),
  },
];

const appliances: Appliance[] = [
  {
    id: 1,
    household_id: 1,
    name: "Air Conditioner (1.5 Ton)",
    category: "Cooling",
    quantity: 1,
    power_rating_watts: 1800.0,
    usage_hours_per_day: 8.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    household_id: 1,
    name: "Double Door Refrigerator",
    category: "Kitchen",
    quantity: 1,
    power_rating_watts: 350.0,
    usage_hours_per_day: 24.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    household_id: 1,
    name: "Washing Machine (Front Load)",
    category: "Laundry",
    quantity: 1,
    power_rating_watts: 800.0,
    usage_hours_per_day: 1.0,
    created_at: new Date().toISOString(),
  },
];

const initialReadingsData = [
  ["2026-08-25", 12.8, "Grid Meter", "Normal workday"],
  ["2026-08-26", 13.2, "Grid Meter", "Normal workday"],
  ["2026-08-27", 12.4, "Grid Meter", "Normal workday"],
  ["2026-08-28", 13.9, "Grid Meter", "Evening guests"],
  ["2026-08-29", 16.5, "Grid Meter", "Weekend laundry and AC"],
  ["2026-08-30", 15.8, "Grid Meter", "Weekend home all day"],
  ["2026-08-31", 11.9, "Grid Meter", "Normal workday"],
  ["2026-09-01", 12.5, "Grid Meter", "Normal workday"],
  ["2026-09-02", 13.1, "Grid Meter", "Normal workday"],
  ["2026-09-03", 12.7, "Grid Meter", "Normal workday"],
  ["2026-09-04", 13.4, "Grid Meter", "Normal workday"],
  ["2026-09-05", 16.1, "Grid Meter", "Weekend baking & washing"],
  ["2026-09-06", 15.4, "Grid Meter", "Weekend family movie day"],
  ["2026-09-07", 12.0, "Grid Meter", "Normal workday"],
  ["2026-09-08", 12.6, "Grid Meter", "Normal workday"],
  ["2026-09-09", 13.0, "Grid Meter", "Normal workday"],
  ["2026-09-10", 12.9, "Grid Meter", "Normal workday"],
  ["2026-09-11", 14.2, "Grid Meter", "Friday evening AC usage"],
  ["2026-09-12", 16.8, "Grid Meter", "Weekend laundry & cooking"],
  ["2026-09-13", 15.7, "Grid Meter", "Sunday family home"],
  ["2026-09-14", 12.2, "Grid Meter", "Monday workday"],
  ["2026-09-15", 12.7, "Grid Meter", "Tuesday workday"],
  ["2026-09-16", 13.5, "Grid Meter", "Wednesday workday"],
] as const;

const energyReadings: EnergyReading[] = initialReadingsData.map(([dt, kwh, src, note], idx) => ({
  id: idx + 1,
  household_id: 1,
  date: dt,
  kwh: Number(kwh),
  source: src,
  notes: note,
  created_at: new Date().toISOString(),
}));

const householdBills: HouseholdBill[] = [
  {
    id: 1,
    household_id: 1,
    amount: 3150.0,
    units: 420.0,
    billing_period: "August 2026",
    tariff_rate: 7.5,
    fixed_charges: 250.0,
    taxes: 120.0,
    other_charges: 0.0,
    discom: "MSEDCL / Adani Electricity Mumbai",
    source: "bill_analyzer",
    updated_at: new Date().toISOString(),
  },
];

const serviceRequests: ServiceRequest[] = [
  {
    id: 1,
    user_id: 1,
    provider_id: 1,
    service_type: "AC Maintenance",
    description: "Annual cleaning and refrigerant inspection",
    requested_date: "2026-03-25",
    address: "Flat 402, Green Meadows, Mumbai",
    status: "Pending",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    user_id: 1,
    provider_id: 2,
    service_type: "Electrical Repair",
    description: "Switchboard rewiring in kitchen",
    requested_date: "2026-03-26",
    address: "Flat 402, Green Meadows, Mumbai",
    status: "Scheduled",
    created_at: new Date().toISOString(),
  },
];

const chatMessages: ChatMessage[] = [];

// ============================================================
// Energy Forecasting & Analytics Helpers
// ============================================================

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function generateForecastFromHistory(dataPoints: Array<{ date_str: string; kwh: number }>) {
  const n = dataPoints.length;
  const sumKwh = dataPoints.reduce((acc, pt) => acc + pt.kwh, 0);
  const meanKwh = n > 0 ? sumKwh / n : 12.5;

  let slope = 0.0;
  if (n >= 2) {
    let num = 0.0;
    let den = 0.0;
    const mid = (n - 1) / 2.0;
    for (let i = 0; i < n; i++) {
      num += (i - mid) * (dataPoints[i].kwh - meanKwh);
      den += (i - mid) * (i - mid);
    }
    slope = den !== 0 ? num / den : 0.0;
  }

  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];

  for (const pt of dataPoints) {
    try {
      const d = new Date(pt.date_str.slice(0, 10));
      if (!isNaN(d.getTime())) {
        const dow = d.getUTCDay();
        dayTotals[dow] += pt.kwh;
        dayCounts[dow] += 1;
      }
    } catch {}
  }

  const dayFactors = dayTotals.map((tot, i) =>
    dayCounts[i] > 0 ? tot / dayCounts[i] / (meanKwh || 1.0) : 1.0
  );

  let lastDate = new Date();
  if (dataPoints.length > 0) {
    try {
      const parsed = new Date(dataPoints[dataPoints.length - 1].date_str.slice(0, 10));
      if (!isNaN(parsed.getTime())) {
        lastDate = parsed;
      }
    } catch {}
  }

  const forecast: Array<{ date: string; predicted_kwh: number; kwh: number }> = [];
  let totalForecastKwh = 0.0;

  for (let i = 1; i <= 30; i++) {
    const nextDate = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = nextDate.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const seasonFactor = dayCounts[dow] > 0 ? dayFactors[dow] : isWeekend ? 1.15 : 0.98;

    const midVal = n > 0 ? (n - 1) / 2.0 : 0.0;
    const trendComponent = slope * (n + i - midVal);
    const projected = Math.max(
      1.5,
      (meanKwh + trendComponent * 0.35) * seasonFactor + Math.sin(i / 2.5) * 0.4
    );
    const roundedKwh = Math.round(projected * 1000) / 1000;

    totalForecastKwh += roundedKwh;
    forecast.push({
      date: nextDate.toISOString().slice(0, 10),
      predicted_kwh: roundedKwh,
      kwh: roundedKwh,
    });
  }

  const avgDaily = Math.round((totalForecastKwh / 30.0) * 1000) / 1000;

  return {
    status: "success",
    data_source: "household_readings",
    summary: {
      forecast_days: 30,
      total_forecast_kwh: Math.round(totalForecastKwh * 1000) / 1000,
      average_daily_forecast_kwh: avgDaily,
      last_historical_date: lastDate.toISOString().slice(0, 10),
      reading_count: n,
    },
    forecast,
  };
}

function buildMonthlyEnergySummary(
  householdId: number,
  tariffRate: number = 7.5,
  includeForecast: boolean = true
) {
  const readings = energyReadings
    .filter((r) => r.household_id === householdId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const bill = householdBills.find((b) => b.household_id === householdId);
  const effectiveTariff = bill?.tariff_rate || tariffRate;

  const monthlyGroups: Record<string, EnergyReading[]> = {};
  for (const r of readings) {
    const parts = r.date.split("-");
    if (parts.length >= 2) {
      const mKey = `${parts[0]}-${parts[1]}`;
      if (!monthlyGroups[mKey]) monthlyGroups[mKey] = [];
      monthlyGroups[mKey].push(r);
    }
  }

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const summaryRows: any[] = [];
  let totalHistKwh = 0.0;
  let totalHistCost = 0.0;

  for (const mKey of Object.keys(monthlyGroups).sort()) {
    const group = monthlyGroups[mKey];
    const [yearStr, monthStr] = mKey.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const monthName = `${monthNames[monthNum - 1]} ${year}`;

    const totalKwh = group.reduce((sum, r) => sum + r.kwh, 0);
    const count = group.length;
    const avgDaily = count > 0 ? totalKwh / count : 0.0;

    let peakR = group[0];
    let lowR = group[0];
    for (const item of group) {
      if (item.kwh > peakR.kwh) peakR = item;
      if (item.kwh < lowR.kwh) lowR = item;
    }

    const estCost = totalKwh * effectiveTariff;
    totalHistKwh += totalKwh;
    totalHistCost += estCost;

    let status = "Completed Month";
    let note = `${count} meter readings logged`;

    if (mKey === currentMonthKey) {
      status = "Current Month (In Progress)";
      note = `${count} days recorded through today`;
    } else if (bill?.billing_period && (bill.billing_period.includes(mKey) || bill.billing_period.includes(monthNames[monthNum - 1]))) {
      note = `Matches uploaded utility bill (${bill.discom})`;
    }

    summaryRows.push({
      month_key: mKey,
      month_name: monthName,
      year,
      month_num: monthNum,
      total_kwh: Math.round(totalKwh * 100) / 100,
      avg_daily_kwh: Math.round(avgDaily * 100) / 100,
      peak_date: peakR.date,
      peak_kwh: Math.round(peakR.kwh * 100) / 100,
      lowest_date: lowR.date,
      lowest_kwh: Math.round(lowR.kwh * 100) / 100,
      days_recorded: count,
      estimated_cost: Math.round(estCost * 100) / 100,
      tariff_rate: Math.round(effectiveTariff * 100) / 100,
      status,
      notes: note,
    });
  }

  if (includeForecast && readings.length >= 5) {
    const dataPoints = readings.map((r) => ({ date_str: r.date, kwh: r.kwh }));
    const forecastRes = generateForecastFromHistory(dataPoints);
    const forecastItems = forecastRes.forecast || [];

    if (forecastItems.length > 0) {
      const fGroups: Record<string, typeof forecastItems> = {};
      for (const it of forecastItems) {
        const fParts = it.date.split("-");
        const fKey = `${fParts[0]}-${fParts[1]}`;
        if (!fGroups[fKey]) fGroups[fKey] = [];
        fGroups[fKey].push(it);
      }

      for (const fKey of Object.keys(fGroups).sort()) {
        if (fKey > currentMonthKey) {
          const fItems = fGroups[fKey];
          const [yStr, mStr] = fKey.split("-");
          const fYear = parseInt(yStr, 10);
          const fMonthNum = parseInt(mStr, 10);
          const fMonthName = `${monthNames[fMonthNum - 1]} ${fYear}`;
          const fTotalKwh = fItems.reduce((acc, it) => acc + it.predicted_kwh, 0);
          const fAvgKwh = fItems.length > 0 ? fTotalKwh / fItems.length : 0.0;

          let fPeak = fItems[0];
          let fLow = fItems[0];
          for (const it of fItems) {
            if (it.predicted_kwh > fPeak.predicted_kwh) fPeak = it;
            if (it.predicted_kwh < fLow.predicted_kwh) fLow = it;
          }
          const fCost = fTotalKwh * effectiveTariff;

          summaryRows.push({
            month_key: fKey,
            month_name: `${fMonthName} (Forecast)`,
            year: fYear,
            month_num: fMonthNum,
            total_kwh: Math.round(fTotalKwh * 100) / 100,
            avg_daily_kwh: Math.round(fAvgKwh * 100) / 100,
            peak_date: fPeak.date,
            peak_kwh: Math.round(fPeak.predicted_kwh * 100) / 100,
            lowest_date: fLow.date,
            lowest_kwh: Math.round(fLow.predicted_kwh * 100) / 100,
            days_recorded: fItems.length,
            estimated_cost: Math.round(fCost * 100) / 100,
            tariff_rate: Math.round(effectiveTariff * 100) / 100,
            status: "Projected (ML Forecast)",
            notes: "30-day linear regression projection with weekday seasonality",
          });
        }
      }
    }
  }

  return {
    household_id: householdId,
    tariff_rate: Math.round(effectiveTariff * 100) / 100,
    total_historical_kwh: Math.round(totalHistKwh * 100) / 100,
    total_historical_cost: Math.round(totalHistCost * 100) / 100,
    months_count: summaryRows.length,
    months: summaryRows,
  };
}

function generateFormattedCsvContent(summaryData: any): string {
  const householdId = summaryData.household_id || 1;
  const tariffRate = summaryData.tariff_rate || 7.5;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  let csv = "";
  csv += "# " + "=".repeat(90) + "\n";
  csv += "# SMART HOUSEHOLD ENERGY MANAGEMENT SYSTEM - MONTHLY CONSUMPTION SUMMARY REPORT\n";
  csv += `# Household ID: ${householdId} | Report Generated: ${now} | Currency: INR (₹)\n`;
  csv += `# Standard Electricity Tariff Rate: ₹${Number(tariffRate).toFixed(2)} / kWh\n`;
  csv += "# " + "=".repeat(90) + "\n";

  const headers = [
    "Month",
    "Year",
    "Total Consumption (kWh)",
    "Avg Daily Usage (kWh/day)",
    "Peak Day Date",
    "Peak Day (kWh)",
    "Lowest Day Date",
    "Lowest Day (kWh)",
    "Days Recorded",
    "Estimated Cost (INR)",
    "Tariff Rate (INR/kWh)",
    "Status",
    "Notes",
  ];
  csv += headers.map((h) => `"${h}"`).join(",") + "\n";

  let totalKwhAll = 0.0;
  let totalCostAll = 0.0;
  let totalDaysAll = 0;

  for (const m of summaryData.months || []) {
    totalKwhAll += m.total_kwh;
    totalCostAll += m.estimated_cost;
    totalDaysAll += m.days_recorded;

    const row = [
      m.month_name,
      m.year,
      m.total_kwh.toFixed(2),
      m.avg_daily_kwh.toFixed(2),
      m.peak_date,
      m.peak_kwh.toFixed(2),
      m.lowest_date,
      m.lowest_kwh.toFixed(2),
      m.days_recorded,
      m.estimated_cost.toFixed(2),
      m.tariff_rate.toFixed(2),
      m.status,
      m.notes,
    ];
    csv += row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n";
  }

  csv += "\n";
  const avgDailyAll = totalDaysAll > 0 ? totalKwhAll / totalDaysAll : 0.0;
  const totalRow = [
    "TOTAL / CUMULATIVE",
    "—",
    totalKwhAll.toFixed(2),
    avgDailyAll.toFixed(2),
    "—",
    "—",
    "—",
    "—",
    totalDaysAll,
    totalCostAll.toFixed(2),
    tariffRate.toFixed(2),
    "Combined Total",
    `Cumulative summary across ${(summaryData.months || []).length} monthly periods`,
  ];
  csv += totalRow.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",") + "\n";

  csv += "\n# " + "=".repeat(90) + "\n";
  csv += "# Summary Statistics:\n";
  csv += `# Total Recorded Consumption: ${totalKwhAll.toFixed(2)} kWh\n`;
  csv += `# Cumulative Estimated Cost: ₹${totalCostAll.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  csv += `# Total Period Days: ${totalDaysAll} days\n`;
  csv += "# " + "=".repeat(90) + "\n";

  return csv;
}

// ============================================================
// Intelligent Fallback & Gemini AI Integration
// ============================================================

function getIntelligentFallback(message: string, userName: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("ac") || msg.includes("air condition") || msg.includes("cooling")) {
    return (
      `Setting your Air Conditioner thermostat to **24°C instead of 18°C-20°C** can reduce compressor energy consumption by up to **24%**.\n\n` +
      `Key Recommendations:\n` +
      `1. Keep AC filters clean (clean every 15 days) to improve airflow by 15%.\n` +
      `2. Pair your AC with a BLDC ceiling fan at low speed to circulate cool air efficiently.\n` +
      `3. 5-Star Inverter ACs save up to ₹450-₹700 monthly compared to non-inverter 3-star models.`
    );
  }
  if (msg.includes("solar") || msg.includes("rooftop") || msg.includes("sun")) {
    return (
      `Under the PM Surya Ghar Muft Bijli Yojana, residential rooftop solar qualifies for attractive subsidies:\n` +
      `- **1 kW System**: ₹30,000 subsidy\n` +
      `- **2 kW System**: ₹60,000 subsidy\n` +
      `- **3 kW+ System**: ₹78,000 maximum subsidy\n\n` +
      `A standard 3 kW system generates ~360 kWh/month, eliminating almost 90% of your average monthly electricity bill with a typical payback period of **3.5 to 4.2 years**.`
    );
  }
  if (msg.includes("bill") || msg.includes("cost") || msg.includes("tariff") || msg.includes("slab")) {
    return (
      `Electricity DISCOM tariffs in India operate on progressive telescopic slabs:\n` +
      `- **0-100 units**: Subsidized rate (~₹3.50 - ₹4.50/unit)\n` +
      `- **101-300 units**: Standard rate (~₹6.50 - ₹7.50/unit)\n` +
      `- **300+ units**: Peak slab (~₹8.50 - ₹10.50/unit)\n\n` +
      `Reducing total monthly consumption by even 25-30 kWh can drop your entire billing into the lower tariff tier, saving ~₹400-₹700 monthly!`
    );
  }
  if (msg.includes("appliance") || msg.includes("geyser") || msg.includes("fridge")) {
    return (
      `Top appliance consumption breakdown for Indian homes:\n` +
      `1. **Air Conditioner**: 40-50% of total summer bill\n` +
      `2. **Water Geyser**: 15-20% in winter (switch to 15-minute timer before bath)\n` +
      `3. **Refrigerator**: Runs 24/7 (~1.2 - 2.0 kWh/day). Keep 3-inch clearance from the wall.\n` +
      `4. **Standby/Phantom loads**: TV set-top boxes, Wi-Fi routers, chargers draw ~5-8% energy even when idle. Use master switches!`
    );
  }
  return (
    `Hello ${userName}! As your Smart Energy Assistant, I can help you with:\n` +
    `- **Bill Reduction Strategies**: Target high-draw appliances and shift usage to off-peak hours.\n` +
    `- **Solar Feasibility**: Calculate capacity, subsidy, and net-metering ROI.\n` +
    `- **Appliance Efficiency**: Wattage ratings and optimal runtime schedules.\n` +
    `- **Consumption Forecasting**: Analyze historical CSV logs for 30-day projections.\n\n` +
    `What would you like to explore first?`
  );
}

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ============================================================
// API Endpoints
// ============================================================

// 1. Health
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Smart Household Energy API",
    backend: "Express + Node.js (TypeScript)",
    database: "In-Memory Store",
    ai: process.env.GEMINI_API_KEY ? "Gemini 2.5 Flash" : "Rule-Based Smart Fallback",
  });
});

// 2. Authentication
app.post("/api/auth/register", (req: Request, res: Response) => {
  const { email, full_name, role, password, phone, address, business_name, categories } = req.body;
  if (!email || !full_name) {
    res.status(400).json({ detail: "Email and full name are required." });
    return;
  }

  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    res.status(400).json({ detail: "Email already registered." });
    return;
  }

  const roleVal = role === "provider" ? "provider" : "household";
  const pwd = password || "password123";

  const newUser: User = {
    id: nextUserId++,
    email: email.toLowerCase().trim(),
    password_hash: hashPassword(pwd),
    full_name: full_name.trim(),
    role: roleVal,
    phone: phone || "",
    address: address || "Mumbai, India",
    created_at: new Date().toISOString(),
  };
  users.push(newUser);

  if (roleVal === "household") {
    households.push({
      id: nextHouseholdId++,
      user_id: newUser.id,
      home_type: "Apartment",
      size_sqft: 1100,
      occupants: 3,
      location: "Mumbai",
      monthly_budget: 3200.0,
      solar_available: false,
      created_at: new Date().toISOString(),
    });
  } else {
    providers.push({
      id: nextProviderId++,
      user_id: newUser.id,
      business_name: business_name || `${newUser.full_name} Services`,
      categories: categories || "Electrical Maintenance, AC Service",
      experience_years: 5,
      location: "Mumbai",
      base_price: "₹500 - ₹1500",
      description: "Certified residential electrical and energy efficiency technician.",
      availability_status: "Available",
      rating: 5.0,
      verified: true,
      created_at: new Date().toISOString(),
    });
  }

  res.json({ message: "User registered successfully", id: newUser.id });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    res.status(400).json({ detail: "Email is required" });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    const roleVal = cleanEmail.includes("provider") ? "provider" : "household";
    const pwd = password || "password123";
    user = {
      id: nextUserId++,
      email: cleanEmail,
      password_hash: hashPassword(pwd),
      full_name: cleanEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      role: roleVal,
      phone: "+91 9876543210",
      address: "Mumbai",
      created_at: new Date().toISOString(),
    };
    users.push(user);

    if (roleVal === "household") {
      households.push({
        id: nextHouseholdId++,
        user_id: user.id,
        home_type: "Apartment",
        size_sqft: 1100,
        occupants: 3,
        location: "Mumbai",
        monthly_budget: 3200.0,
        solar_available: false,
        created_at: new Date().toISOString(),
      });
    } else {
      providers.push({
        id: nextProviderId++,
        user_id: user.id,
        business_name: `${user.full_name} Services`,
        categories: "Electrical, AC Services",
        experience_years: 4,
        location: "Mumbai",
        base_price: "₹500",
        description: "Professional home energy technician.",
        availability_status: "Available",
        rating: 4.9,
        verified: true,
        created_at: new Date().toISOString(),
      });
    }
  } else if (password && user.password_hash !== hashPassword(password)) {
    res.status(401).json({ detail: "Invalid email or password." });
    return;
  }

  const token = generateToken(user);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
      address: user.address,
      created_at: user.created_at,
    },
  });
});

// 3. Users & Household
app.get("/api/users/:userId", (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ detail: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    phone: user.phone,
    address: user.address,
    created_at: user.created_at,
  });
});

app.put("/api/users/:userId", (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ detail: "User not found" });
    return;
  }
  if (req.body.full_name !== undefined) user.full_name = req.body.full_name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.address !== undefined) user.address = req.body.address;
  res.json(user);
});

app.get("/api/household/:userId", (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  let hh = households.find((h) => h.user_id === userId || h.id === userId);
  if (!hh) {
    hh = {
      id: nextHouseholdId++,
      user_id: userId,
      home_type: "Apartment",
      size_sqft: 1250,
      occupants: 4,
      location: "Mumbai",
      monthly_budget: 3500.0,
      solar_available: false,
      created_at: new Date().toISOString(),
    };
    households.push(hh);
  }
  res.json(hh);
});

app.put("/api/household/:householdId", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  let hh = households.find((h) => h.id === householdId);
  if (!hh) {
    hh = {
      id: householdId,
      user_id: 1,
      home_type: "Apartment",
      size_sqft: 1200,
      occupants: 4,
      location: "Mumbai",
      monthly_budget: 3500.0,
      solar_available: false,
      created_at: new Date().toISOString(),
    };
    households.push(hh);
  }
  const fields = ["home_type", "size_sqft", "occupants", "location", "monthly_budget", "solar_available"] as const;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      (hh as any)[f] = req.body[f];
    }
  }
  res.json(hh);
});

// Household Bill
app.get("/api/household/:householdId/bill", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const bill = householdBills.find((b) => b.household_id === householdId);
  res.json(bill || null);
});

app.post("/api/household/:householdId/bill", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const body = req.body;
  let bill = householdBills.find((b) => b.household_id === householdId);

  const amount = Number(body.amount || 0);
  const units = Number(body.units || 0);
  const billing_period = body.billingPeriod || body.billing_period || "Current Utility Bill";
  const tariff_rate = Number(body.tariffRate || body.tariff_rate || 7.5);
  const fixed_charges = Number(body.fixedCharges || body.fixed_charges || 250.0);
  const taxes = Number(body.taxes || 0);
  const other_charges = Number(body.otherCharges || body.other_charges || 0);
  const discom = body.discom || "Utility Provider";
  const source = body.source || "bill_analyzer";

  if (!bill) {
    bill = {
      id: nextBillId++,
      household_id: householdId,
      amount,
      units,
      billing_period,
      tariff_rate,
      fixed_charges,
      taxes,
      other_charges,
      discom,
      source,
      updated_at: new Date().toISOString(),
    };
    householdBills.push(bill);
  } else {
    bill.amount = amount;
    bill.units = units;
    bill.billing_period = billing_period;
    bill.tariff_rate = tariff_rate;
    bill.fixed_charges = fixed_charges;
    bill.taxes = taxes;
    bill.other_charges = other_charges;
    bill.discom = discom;
    bill.source = source;
    bill.updated_at = new Date().toISOString();
  }

  res.json({
    success: true,
    bill: {
      household_id: bill.household_id,
      amount: bill.amount,
      units: bill.units,
      billing_period: bill.billing_period,
      tariff_rate: bill.tariff_rate,
      fixed_charges: bill.fixed_charges,
      taxes: bill.taxes,
      other_charges: bill.other_charges,
      discom: bill.discom,
      source: bill.source,
      updated_at: bill.updated_at,
    },
  });
});

app.delete("/api/household/:householdId/bill", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const idx = householdBills.findIndex((b) => b.household_id === householdId);
  if (idx !== -1) {
    householdBills.splice(idx, 1);
  }
  res.json({ success: true });
});

// 4. Appliances
app.get("/api/household/:householdId/appliances", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const apps = appliances.filter((a) => a.household_id === householdId);
  res.json(apps);
});

app.post("/api/household/:householdId/appliances", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const body = req.body;
  const name = body.name || "Appliance";
  const category = body.category || "General";
  const quantity = parseInt(body.quantity || 1, 10);
  const power = parseFloat(body.power_rating_watts || body.power || 500.0);
  const hours = parseFloat(body.usage_hours_per_day || body.hours || 4.0);

  if (body.id) {
    const existing = appliances.find((a) => a.id === parseInt(body.id, 10));
    if (existing) {
      existing.name = name;
      existing.category = category;
      existing.quantity = quantity;
      existing.power_rating_watts = power;
      existing.usage_hours_per_day = hours;
      res.json(existing);
      return;
    }
  }

  const newApp: Appliance = {
    id: nextApplianceId++,
    household_id: householdId,
    name,
    category,
    quantity,
    power_rating_watts: power,
    usage_hours_per_day: hours,
    created_at: new Date().toISOString(),
  };
  appliances.push(newApp);
  res.json(newApp);
});

app.put("/api/household/:householdId/appliances/:appId", (req: Request, res: Response) => {
  const appId = parseInt(req.params.appId, 10);
  const appItem = appliances.find((a) => a.id === appId);
  if (!appItem) {
    res.status(404).json({ detail: "Appliance not found" });
    return;
  }
  if (req.body.name !== undefined) appItem.name = req.body.name;
  if (req.body.category !== undefined) appItem.category = req.body.category;
  if (req.body.quantity !== undefined) appItem.quantity = parseInt(req.body.quantity, 10);
  if (req.body.power_rating_watts !== undefined || req.body.power !== undefined) {
    appItem.power_rating_watts = parseFloat(req.body.power_rating_watts || req.body.power);
  }
  if (req.body.usage_hours_per_day !== undefined || req.body.hours !== undefined) {
    appItem.usage_hours_per_day = parseFloat(req.body.usage_hours_per_day || req.body.hours);
  }
  res.json(appItem);
});

app.delete("/api/household/:householdId/appliances/:appId", (req: Request, res: Response) => {
  const appId = parseInt(req.params.appId, 10);
  const idx = appliances.findIndex((a) => a.id === appId);
  if (idx !== -1) appliances.splice(idx, 1);
  res.json({ success: true, id: appId });
});

app.delete("/api/appliances/:appId", (req: Request, res: Response) => {
  const appId = parseInt(req.params.appId, 10);
  const idx = appliances.findIndex((a) => a.id === appId);
  if (idx !== -1) appliances.splice(idx, 1);
  res.json({ success: true, id: appId });
});

// 5. Energy Readings & Forecasting
const getReadingsHandler = (req: Request, res: Response) => {
  const householdId = req.params.householdId ? parseInt(req.params.householdId, 10) : 1;
  const filtered = energyReadings
    .filter((r) => r.household_id === householdId)
    .sort((a, b) => a.date.localeCompare(b.date));
  res.json(filtered);
};
app.get("/api/energy/readings", getReadingsHandler);
app.get("/api/energy/readings/:householdId", getReadingsHandler);

const addReadingHandler = (req: Request, res: Response) => {
  const householdId = req.params.householdId ? parseInt(req.params.householdId, 10) : req.body.household_id || 1;
  const kwh = Number(req.body.kwh);
  if (isNaN(kwh) || kwh < 0) {
    res.status(400).json({ detail: "Consumption (kWh) must be a non-negative number." });
    return;
  }

  const dateStr = req.body.date || new Date().toISOString().slice(0, 10);
  const newReading: EnergyReading = {
    id: nextReadingId++,
    household_id: householdId,
    date: dateStr,
    kwh: Math.round(kwh * 1000) / 1000,
    source: req.body.source || "Grid Meter",
    notes: req.body.notes || "",
    created_at: new Date().toISOString(),
  };
  energyReadings.push(newReading);
  res.status(201).json(newReading);
};
app.post("/api/energy/readings", addReadingHandler);
app.post("/api/energy/readings/:householdId", addReadingHandler);

app.delete("/api/energy/readings/:readingId", (req: Request, res: Response) => {
  const readingId = parseInt(req.params.readingId, 10);
  const idx = energyReadings.findIndex((r) => r.id === readingId);
  if (idx === -1) {
    res.status(404).json({ detail: "Reading not found" });
    return;
  }
  energyReadings.splice(idx, 1);
  res.json({ message: "Reading deleted successfully", id: readingId });
});

app.post("/api/energy/consumption/:householdId", (req: Request, res: Response) => {
  const householdId = parseInt(req.params.householdId, 10);
  const kwh = parseFloat(req.body.kwh || 0);
  if (kwh < 0) {
    res.status(400).json({ detail: "Consumption cannot be negative." });
    return;
  }
  const dateStr = req.body.date || new Date().toISOString().slice(0, 10);
  const newReading: EnergyReading = {
    id: nextReadingId++,
    household_id: householdId,
    date: dateStr,
    kwh: Math.round(kwh * 1000) / 1000,
    source: req.body.source || "Grid Meter",
    notes: "",
    created_at: new Date().toISOString(),
  };
  energyReadings.push(newReading);
  res.json({
    message: "Consumption added",
    id: newReading.id,
    reading: {
      id: newReading.id,
      household_id: newReading.household_id,
      date: newReading.date,
      kwh: newReading.kwh,
      source: newReading.source,
    },
  });
});

const generateForecastHandler = (req: Request, res: Response) => {
  const householdId = req.params.householdId ? parseInt(req.params.householdId, 10) : 1;
  const readings = energyReadings
    .filter((r) => r.household_id === householdId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = readings.map((r) => ({ date_str: r.date, kwh: r.kwh }));
  const result = generateForecastFromHistory(dataPoints);
  res.json(result);
};
app.get("/api/energy/forecast", generateForecastHandler);
app.get("/api/energy/forecast/:householdId", generateForecastHandler);
app.post("/api/energy/forecast", generateForecastHandler);
app.post("/api/energy/forecast/:householdId", generateForecastHandler);

app.post("/api/energy/forecast/upload", upload.single("file"), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ detail: "No file was selected." });
    return;
  }
  if (!file.originalname.toLowerCase().endsWith(".csv")) {
    res.status(400).json({ detail: "Please upload a CSV file." });
    return;
  }

  const content = file.buffer.toString("utf-8");
  const rawLines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (rawLines.length < 2) {
    res.status(400).json({ detail: "Uploaded CSV contains no records." });
    return;
  }

  const header = rawLines[0].split(",").map((c) => c.trim().toLowerCase().replace(/['"]/g, ""));
  let dateCol = 0;
  for (let idx = 0; idx < header.length; idx++) {
    if (["timestamp", "date", "datetime", "time"].includes(header[idx])) {
      dateCol = idx;
      break;
    }
  }

  let kwhCol = header.length - 1;
  for (let idx = 0; idx < header.length; idx++) {
    if (["kwh", "consumption", "units", "energy", "predicted_kwh"].includes(header[idx])) {
      kwhCol = idx;
      break;
    }
  }

  const dataPoints: Array<{ date_str: string; kwh: number }> = [];
  for (let i = 1; i < rawLines.length; i++) {
    const parts = rawLines[i].split(",").map((p) => p.trim().replace(/['"]/g, ""));
    if (parts.length > Math.max(dateCol, kwhCol)) {
      const val = parseFloat(parts[kwhCol]);
      if (!isNaN(val) && val >= 0) {
        dataPoints.push({ date_str: parts[dateCol], kwh: val });
      }
    }
  }

  if (dataPoints.length < 15) {
    res.status(400).json({
      detail: "Uploaded CSV must contain at least 15 records of historical energy data.",
    });
    return;
  }

  const result: any = generateForecastFromHistory(dataPoints);
  result.data_source = "user_dataset";
  result.uploaded_file = file.originalname;
  result.uploaded_records = dataPoints.length;
  res.json(result);
});

// Monthly Summary
const getMonthlySummaryHandler = (req: Request, res: Response) => {
  const householdId = req.params.householdId ? parseInt(req.params.householdId, 10) : 1;
  const tariffRate = req.query.tariff_rate ? parseFloat(String(req.query.tariff_rate)) : 7.5;
  const includeForecast = req.query.include_forecast !== "false";
  const result = buildMonthlyEnergySummary(householdId, tariffRate, includeForecast);
  res.json(result);
};
app.get("/api/energy/monthly-summary", getMonthlySummaryHandler);
app.get("/api/energy/monthly-summary/:householdId", getMonthlySummaryHandler);

const downloadCsvHandler = (req: Request, res: Response) => {
  const householdId = req.params.householdId ? parseInt(req.params.householdId, 10) : 1;
  const tariffRate = req.query.tariff_rate ? parseFloat(String(req.query.tariff_rate)) : 7.5;
  const includeForecast = req.query.include_forecast !== "false";
  const summaryData = buildMonthlyEnergySummary(householdId, tariffRate, includeForecast);
  const csvContent = generateFormattedCsvContent(summaryData);
  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `monthly_energy_consumption_summary_household_${householdId}_${todayStr}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  res.send(csvContent);
};
app.get("/api/energy/monthly-summary/csv", downloadCsvHandler);
app.get("/api/energy/monthly-summary/csv/:householdId", downloadCsvHandler);
app.get("/api/energy/download-csv", downloadCsvHandler);
app.get("/api/energy/download-csv/:householdId", downloadCsvHandler);

// 6. Providers & Service Requests
app.get("/api/providers", (req: Request, res: Response) => {
  const { category, location, search } = req.query;
  let results = providers;
  if (category && category !== "all") {
    const catStr = String(category).toLowerCase();
    results = results.filter((p) => p.categories.toLowerCase().includes(catStr));
  }
  if (location && location !== "all") {
    const locStr = String(location).toLowerCase();
    results = results.filter((p) => p.location.toLowerCase().includes(locStr));
  }
  if (search) {
    const q = String(search).toLowerCase();
    results = results.filter(
      (p) =>
        p.business_name.toLowerCase().includes(q) ||
        p.categories.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }
  res.json(results);
});

app.get("/api/providers/:userId", (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  let p = providers.find((pr) => pr.user_id === userId || pr.id === userId);
  if (!p) p = providers[0];
  if (!p) {
    res.status(404).json({ detail: "Provider not found" });
    return;
  }
  res.json(p);
});

app.put("/api/providers/:providerId", (req: Request, res: Response) => {
  const providerId = parseInt(req.params.providerId, 10);
  const p = providers.find((pr) => pr.id === providerId);
  if (!p) {
    res.status(404).json({ detail: "Provider not found" });
    return;
  }
  const fields = [
    "business_name", "categories", "experience_years", "location",
    "base_price", "description", "availability_status", "rating", "verified",
  ] as const;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      (p as any)[f] = req.body[f];
    }
  }
  res.json(p);
});

app.post("/api/service-requests", (req: Request, res: Response) => {
  const { user_id, provider_id, service_type, description, requested_date, address } = req.body;
  const newReq: ServiceRequest = {
    id: nextServiceRequestId++,
    user_id: user_id || 1,
    provider_id: provider_id || 1,
    service_type: service_type || "Maintenance",
    description: description || "",
    requested_date: requested_date || "2026-03-25",
    address: address || "Mumbai",
    status: "Pending",
    created_at: new Date().toISOString(),
  };
  serviceRequests.push(newReq);
  res.json(newReq);
});

app.get("/api/service-requests/user/:userId", (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const list = serviceRequests.filter((s) => s.user_id === userId);
  res.json(list);
});

app.get("/api/service-requests/provider/:providerId", (req: Request, res: Response) => {
  const providerId = parseInt(req.params.providerId, 10);
  const list = serviceRequests.filter((s) => s.provider_id === providerId);
  res.json(list);
});

app.put("/api/service-requests/:requestId/status", (req: Request, res: Response) => {
  const requestId = parseInt(req.params.requestId, 10);
  const r = serviceRequests.find((s) => s.id === requestId);
  if (!r) {
    res.status(404).json({ detail: "Request not found" });
    return;
  }
  r.status = req.body.status || r.status;
  res.json(r);
});

// 7. AI Assistant Endpoint
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  const { message, user_id, conversation_id } = req.body;
  if (!message || !message.trim()) {
    res.status(400).json({ detail: "Message is required." });
    return;
  }

  const convId = conversation_id || (Math.floor(Date.now() / 1000) % 1000000);
  const userId = user_id || 1;
  const user = users.find((u) => u.id === userId);
  const hh = households.find((h) => h.user_id === userId);

  const userName = user?.full_name || "Household Resident";
  const homeType = hh?.home_type || "Apartment";
  const budget = hh?.monthly_budget || 3500.0;

  const systemInstruction =
    `You are a Smart Household Energy Assistant for an Indian residential household.\n` +
    `User Context:\n` +
    `- Name: ${userName}\n` +
    `- Home Type: ${homeType}\n` +
    `- Typical Monthly Budget: ₹${budget}\n` +
    `- Target: Help the user understand energy consumption, optimize appliance runtime, explain electricity tariff slabs (DISCOM / TNERC / MSEDCL / BESCOM / UPPCL style), evaluate solar rooftop ROI, and suggest practical energy-saving actions.\n` +
    `Always use ₹ (INR) for currency and kWh for electricity consumption. Keep answers practical, encouraging, and clear.`;

  let aiReply = "";

  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `${systemInstruction}\n\nUser Question: ${message}` }] },
        ],
      });
      aiReply = response.text?.trim() || "";
    } catch (err: any) {
      console.warn("[Gemini API Warning] Falling back to intelligent assistant rules:", err?.message || err);
    }
  }

  if (!aiReply) {
    aiReply = getIntelligentFallback(message, userName);
  }

  chatMessages.push({
    id: nextChatId++,
    conversation_id: convId,
    user_id: userId,
    sender: "user",
    content: message,
    created_at: new Date().toISOString(),
  });
  chatMessages.push({
    id: nextChatId++,
    conversation_id: convId,
    user_id: userId,
    sender: "assistant",
    content: aiReply,
    created_at: new Date().toISOString(),
  });

  res.json({
    response: aiReply,
    conversation_id: convId,
  });
});

// ============================================================
// 8. AC Appliance Software Simulator & Predictive Maintenance Engine
// ============================================================

interface DeviceTelemetry {
  id: number;
  device_id: string;
  device_name: string;
  device_type: "ac_simulator" | "laptop";
  timestamp: string;
  power_w: number;
  voltage_v: number;
  current_a: number;
  energy_kwh: number;
  temperature_c: number | null;
  operating_state: string;
  power_measurement_type: "direct_appliance_sim" | "battery_side_measured";
  metrics: Record<string, any>;
}

interface DeviceHealthState {
  device_id: string;
  device_name: string;
  device_type: "ac_simulator" | "laptop";
  health_status: "Healthy" | "Attention Required" | "Maintenance Required";
  anomaly_score: number;
  anomaly_reasons: string[];
  persistence_count: number;
  explanation_mistral: string;
  active_ticket_id: number | null;
  last_updated: string;
}

interface AutoServiceTicket {
  id: number;
  ticket_number: string;
  device_id: string;
  device_name: string;
  user_id: number;
  provider_id: number;
  provider_name: string;
  service_type: string;
  issue_summary: string;
  detailed_explanation: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Auto-Created" | "Assigned" | "In-Progress" | "Resolved";
  auto_generated: boolean;
  created_at: string;
}

let nextTelemetryId = 1;
let nextTicketId = 101;

const telemetryBuffer: Record<string, DeviceTelemetry[]> = {
  ac_simulator: [],
  laptop_primary: [],
};

const deviceHealth: Record<string, DeviceHealthState> = {
  ac_simulator: {
    device_id: "ac_simulator",
    device_name: "Living Room AC (1.5 Ton)",
    device_type: "ac_simulator",
    health_status: "Healthy",
    anomaly_score: 0.05,
    anomaly_reasons: [],
    persistence_count: 0,
    explanation_mistral: "AC unit is operating within normal thermodynamic and electrical parameters.",
    active_ticket_id: null,
    last_updated: new Date().toISOString(),
  },
  laptop_primary: {
    device_id: "laptop_primary",
    device_name: "Primary User Laptop",
    device_type: "laptop",
    health_status: "Healthy",
    anomaly_score: 0.05,
    anomaly_reasons: [],
    persistence_count: 0,
    explanation_mistral: "Laptop battery and system draw are within standard operational limits.",
    active_ticket_id: null,
    last_updated: new Date().toISOString(),
  },
};

const autoServiceTickets: AutoServiceTicket[] = [];

// AC Simulator State Configuration
let acSimulatorState = {
  running: true,
  paused: false,
  speed_multiplier: 1,
  scenario: "NORMAL" as "NORMAL" | "HIGH_POWER" | "LONG_RUNTIME" | "FREQUENT_CYCLING" | "ABNORMAL_TEMP",
  power_watts: 1450.0,
  voltage_v: 230.0,
  current_a: 6.3,
  energy_kwh: 12.4,
  runtime_minutes: 120,
  operating_state: "COOLING" as "OFF" | "COOLING" | "FAN_ONLY" | "IDLE",
  temperature_c: 26.5,
  target_temperature_c: 24.0,
  compressor_status: "ON" as "ON" | "OFF",
  fan_status: "MEDIUM" as "OFF" | "LOW" | "MEDIUM" | "HIGH",
  cycle_count: 4,
  last_toggle_time: Date.now(),
  created_at: new Date().toISOString(),
};

// Mistral AI Helper Function
async function callMistralAI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY || "";
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt || "You are an expert AI Smart Household Energy & Predictive Maintenance Technician." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 250,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    } else {
      const errText = await response.text();
      console.warn("[Mistral API Warning]", response.status, errText);
    }
  } catch (err: any) {
    console.warn("[Mistral API Error]", err?.message || err);
  }
  return "";
}

// Numerical Anomaly & Predictive Maintenance Pipeline
async function evaluateDeviceHealthAndTicketWorkflow(deviceId: string, latest: DeviceTelemetry) {
  const health = deviceHealth[deviceId] || {
    device_id: deviceId,
    device_name: latest.device_name,
    device_type: latest.device_type,
    health_status: "Healthy",
    anomaly_score: 0.05,
    anomaly_reasons: [],
    persistence_count: 0,
    explanation_mistral: "",
    active_ticket_id: null,
    last_updated: new Date().toISOString(),
  };

  const reasons: string[] = [];
  let rawScore = 0.05;

  if (latest.device_type === "ac_simulator") {
    const p = latest.power_w;
    const temp = latest.temperature_c || 25.0;
    const runtime = latest.metrics.runtime_minutes || 0;
    const scenario = acSimulatorState.scenario;

    if (p > 2200 || scenario === "HIGH_POWER") {
      reasons.push(`Abnormal Power Surge: Draw peaked at ${p.toFixed(0)}W exceeding standard 1800W rating.`);
      rawScore = Math.max(rawScore, 0.88);
    }
    if (runtime > 180 || scenario === "LONG_RUNTIME") {
      reasons.push(`Extended Continuous Runtime: Compressor running for ${runtime} mins without thermal cycling.`);
      rawScore = Math.max(rawScore, 0.82);
    }
    if (scenario === "FREQUENT_CYCLING") {
      reasons.push(`Frequent Compressor Cycling: Rapid switching between ON/OFF states detected.`);
      rawScore = Math.max(rawScore, 0.79);
    }
    if (temp > 32.0 || scenario === "ABNORMAL_TEMP") {
      reasons.push(`Abnormal High Room Temperature: Ambient temp at ${temp.toFixed(1)}°C despite cooling mode.`);
      rawScore = Math.max(rawScore, 0.85);
    }
  } else if (latest.device_type === "laptop") {
    const p = latest.power_w;
    const cpu = latest.metrics.cpu_percent || 0;
    const temp = latest.temperature_c;
    const discharge = latest.metrics.discharge_rate_w || 0;

    if (p > 35.0 || discharge > 35.0) {
      reasons.push(`High Battery Discharge Rate: Measured power draw of ${p.toFixed(1)}W exceeds normal envelope.`);
      rawScore = Math.max(rawScore, 0.80);
    }
    if (cpu > 90.0) {
      reasons.push(`Persistent High CPU Load: Sustained ${cpu.toFixed(0)}% utilization.`);
      rawScore = Math.max(rawScore, 0.75);
    }
    if (temp && temp > 80.0) {
      reasons.push(`System Thermal Stress: CPU/Sensor temperature reached ${temp.toFixed(1)}°C.`);
      rawScore = Math.max(rawScore, 0.86);
    }
  }

  const isAnomalous = reasons.length > 0;

  if (isAnomalous) {
    health.persistence_count += 1;
    health.anomaly_score = Math.min(0.98, rawScore + (health.persistence_count * 0.03));
    health.anomaly_reasons = reasons;
  } else {
    health.persistence_count = Math.max(0, health.persistence_count - 1);
    if (health.persistence_count === 0) {
      health.anomaly_score = 0.05;
      health.anomaly_reasons = [];
    }
  }

  // State Transitions based on Persistence (Requires N >= 3 consecutive anomaly checks for Maintenance)
  const prevStatus = health.health_status;
  if (health.persistence_count >= 3) {
    health.health_status = "Maintenance Required";
  } else if (health.persistence_count >= 1) {
    health.health_status = "Attention Required";
  } else {
    health.health_status = "Healthy";
  }

  health.last_updated = new Date().toISOString();

  // Generate Mistral Explanation if state changed or new anomaly detected
  if (isAnomalous && (!health.explanation_mistral || prevStatus !== health.health_status)) {
    const prompt =
      `Device '${latest.device_name}' (${latest.device_type}) health status updated to ${health.health_status}.\n` +
      `Power: ${latest.power_w}W, Temp: ${latest.temperature_c || 'N/A'}°C, Persistence count: ${health.persistence_count}.\n` +
      `Flagged Reasons: ${reasons.join("; ")}.\n` +
      `Provide a 2-sentence explanation of why this device is flagged and what maintenance risk it poses.`;

    const mistralExplanation = await callMistralAI(prompt);
    health.explanation_mistral = mistralExplanation ||
      `Device '${latest.device_name}' shows persistent abnormal operating metrics (${reasons[0]}). Inspection recommended to prevent equipment degradation.`;
  } else if (!isAnomalous && health.health_status === "Healthy") {
    health.explanation_mistral = `Device '${latest.device_name}' is operating in optimal health condition. All parameters normal.`;
  }

  // AUTOMATIC SERVICE PROVIDER WORKFLOW
  // Trigger automatic ticket dispatch when health reaches Maintenance Required & no active ticket exists
  if (health.health_status === "Maintenance Required" && !health.active_ticket_id) {
    const matchingCategory = latest.device_type === "ac_simulator" ? "ac" : "electrical";
    const selectedProvider = providers.find((p) => p.categories.toLowerCase().includes(matchingCategory)) || providers[0];

    const ticketId = nextTicketId++;
    const ticketNum = `TKT-2026-${String(ticketId).padStart(3, "0")}`;
    const serviceType = latest.device_type === "ac_simulator" ? "AC Compressor & HVAC Overhaul" : "Laptop Power & Battery Diagnostic";
    const issueSummary = `Automated Alert: Persistent anomaly detected on ${latest.device_name} (${reasons[0] || "Abnormal metrics"})`;

    const ticketPrompt =
      `Generate a concise service ticket description for an auto-dispatched ticket:\n` +
      `Device: ${latest.device_name}\n` +
      `Detected Anomaly: ${reasons.join(", ")}\n` +
      `Assigned Service Provider: ${selectedProvider?.business_name || "Emergency Tech"}\n` +
      `Provide a 2-sentence technical instruction summary for the field service technician.`;

    const detailedExplanation = await callMistralAI(ticketPrompt) ||
      `Automated service dispatch triggered due to persistent telemetry anomalies (${reasons.join("; ")}). Technical inspection and component diagnostic required.`;

    const newTicket: AutoServiceTicket = {
      id: ticketId,
      ticket_number: ticketNum,
      device_id: deviceId,
      device_name: latest.device_name,
      user_id: 1,
      provider_id: selectedProvider ? selectedProvider.id : 1,
      provider_name: selectedProvider ? selectedProvider.business_name : "CoolAir Solutions",
      service_type: serviceType,
      issue_summary: issueSummary,
      detailed_explanation: detailedExplanation,
      severity: health.anomaly_score > 0.85 ? "Critical" : "High",
      status: "Auto-Created",
      auto_generated: true,
      created_at: new Date().toISOString(),
    };

    autoServiceTickets.unshift(newTicket);
    health.active_ticket_id = newTicket.id;

    // Also sync to existing serviceRequests array so Provider Dashboard sees it seamlessly
    serviceRequests.unshift({
      id: newTicket.id,
      user_id: 1,
      provider_id: newTicket.provider_id,
      service_type: `${newTicket.service_type} (${newTicket.ticket_number})`,
      description: `${newTicket.issue_summary}. ${newTicket.detailed_explanation}`,
      requested_date: new Date().toISOString().slice(0, 10),
      address: "Flat 402, Green Meadows, Mumbai",
      status: "Pending",
      created_at: new Date().toISOString(),
    });

    console.log(`[Auto Service Workflow] Created ticket ${ticketNum} for provider ${selectedProvider?.business_name}`);
  }

  deviceHealth[deviceId] = health;
}

// Background AC Simulator Loop (Runs continuous physics tick)
setInterval(async () => {
  if (!acSimulatorState.running || acSimulatorState.paused) return;

  const dtSec = 2.0 * acSimulatorState.speed_multiplier;
  let power = 1450.0;
  let state: "COOLING" | "FAN_ONLY" | "IDLE" | "OFF" = "COOLING";
  let compStatus: "ON" | "OFF" = "ON";
  let tempDelta = -0.1 * (dtSec / 2.0);

  switch (acSimulatorState.scenario) {
    case "HIGH_POWER":
      power = 2850.0 + (Math.random() * 200 - 100);
      state = "COOLING";
      compStatus = "ON";
      tempDelta = -0.05;
      break;
    case "LONG_RUNTIME":
      power = 1750.0 + (Math.random() * 50 - 25);
      state = "COOLING";
      compStatus = "ON";
      tempDelta = 0.02; // Temperature creeps up despite compressor running
      break;
    case "FREQUENT_CYCLING":
      if (Date.now() - acSimulatorState.last_toggle_time > 4000) {
        acSimulatorState.compressor_status = acSimulatorState.compressor_status === "ON" ? "OFF" : "ON";
        acSimulatorState.last_toggle_time = Date.now();
        acSimulatorState.cycle_count += 1;
      }
      compStatus = acSimulatorState.compressor_status;
      power = compStatus === "ON" ? 1650.0 : 80.0;
      state = compStatus === "ON" ? "COOLING" : "FAN_ONLY";
      break;
    case "ABNORMAL_TEMP":
      power = 1600.0;
      state = "COOLING";
      compStatus = "ON";
      tempDelta = +0.2; // Thermal failure
      break;
    case "NORMAL":
    default:
      if (acSimulatorState.temperature_c <= acSimulatorState.target_temperature_c) {
        state = "FAN_ONLY";
        compStatus = "OFF";
        power = 75.0;
        tempDelta = +0.05;
      } else {
        state = "COOLING";
        compStatus = "ON";
        power = 1450.0 + (Math.random() * 60 - 30);
        tempDelta = -0.08;
      }
      break;
  }

  acSimulatorState.power_watts = Math.round(power * 10) / 10;
  acSimulatorState.operating_state = state;
  acSimulatorState.compressor_status = compStatus;
  acSimulatorState.temperature_c = Math.min(40.0, Math.max(16.0, Math.round((acSimulatorState.temperature_c + tempDelta) * 10) / 10));
  acSimulatorState.voltage_v = Math.round((228.0 + Math.sin(Date.now() / 2000) * 4.0) * 10) / 10;
  acSimulatorState.current_a = Math.round((acSimulatorState.power_watts / (acSimulatorState.voltage_v * 0.92)) * 10) / 10;
  
  const addedKwh = (acSimulatorState.power_watts * (dtSec / 3600.0)) / 1000.0;
  acSimulatorState.energy_kwh = Math.round((acSimulatorState.energy_kwh + addedKwh) * 10000) / 10000;
  acSimulatorState.runtime_minutes += Math.round(dtSec / 60.0) || 1;

  const telemetryReading: DeviceTelemetry = {
    id: nextTelemetryId++,
    device_id: "ac_simulator",
    device_name: "Living Room AC (1.5 Ton)",
    device_type: "ac_simulator",
    timestamp: new Date().toISOString(),
    power_w: acSimulatorState.power_watts,
    voltage_v: acSimulatorState.voltage_v,
    current_a: acSimulatorState.current_a,
    energy_kwh: acSimulatorState.energy_kwh,
    temperature_c: acSimulatorState.temperature_c,
    operating_state: acSimulatorState.operating_state,
    power_measurement_type: "direct_appliance_sim",
    metrics: {
      target_temperature_c: acSimulatorState.target_temperature_c,
      compressor_status: acSimulatorState.compressor_status,
      fan_status: acSimulatorState.fan_status,
      scenario: acSimulatorState.scenario,
      speed_multiplier: acSimulatorState.speed_multiplier,
      runtime_minutes: acSimulatorState.runtime_minutes,
      cycle_count: acSimulatorState.cycle_count,
    },
  };

  telemetryBuffer.ac_simulator.push(telemetryReading);
  if (telemetryBuffer.ac_simulator.length > 60) telemetryBuffer.ac_simulator.shift();

  await evaluateDeviceHealthAndTicketWorkflow("ac_simulator", telemetryReading);
}, 2000);

// Telemetry API Endpoints

// AC Simulator Control Endpoint
app.post("/api/simulator/ac/control", (req: Request, res: Response) => {
  const { action, scenario, speed_multiplier, target_temp } = req.body;

  if (action === "start") acSimulatorState.running = true;
  if (action === "stop") acSimulatorState.running = false;
  if (action === "pause") acSimulatorState.paused = true;
  if (action === "resume") acSimulatorState.paused = false;

  if (scenario) acSimulatorState.scenario = scenario;
  if (speed_multiplier) acSimulatorState.speed_multiplier = Number(speed_multiplier);
  if (target_temp) acSimulatorState.target_temperature_c = Number(target_temp);

  res.json({ success: true, state: acSimulatorState });
});

app.get("/api/simulator/ac/telemetry", (_req: Request, res: Response) => {
  res.json({
    state: acSimulatorState,
    history: telemetryBuffer.ac_simulator,
    health: deviceHealth.ac_simulator,
  });
});

// Live Laptop Telemetry Ingestion Endpoint
app.post("/api/telemetry/laptop", async (req: Request, res: Response) => {
  const body = req.body;
  const powerW = Number(body.power_w || 12.0);
  const voltageV = Number(body.voltage_v || 19.5);
  const currentA = Number(body.current_a || (powerW / voltageV));
  const energyKwh = Number(body.energy_kwh || 0.001);

  const telemetryReading: DeviceTelemetry = {
    id: nextTelemetryId++,
    device_id: "laptop_primary",
    device_name: body.device_name || "Primary User Laptop",
    device_type: "laptop",
    timestamp: body.timestamp || new Date().toISOString(),
    power_w: Math.round(powerW * 100) / 100,
    voltage_v: Math.round(voltageV * 100) / 100,
    current_a: Math.round(currentA * 100) / 100,
    energy_kwh: Math.round(energyKwh * 100000) / 100000,
    temperature_c: body.temperature_c !== undefined ? body.temperature_c : null,
    operating_state: body.operating_state || "ACTIVE",
    power_measurement_type: "battery_side_measured",
    metrics: body.metrics || {},
  };

  telemetryBuffer.laptop_primary.push(telemetryReading);
  if (telemetryBuffer.laptop_primary.length > 60) telemetryBuffer.laptop_primary.shift();

  await evaluateDeviceHealthAndTicketWorkflow("laptop_primary", telemetryReading);

  res.json({
    success: true,
    health_status: deviceHealth.laptop_primary.health_status,
    anomaly_score: deviceHealth.laptop_primary.anomaly_score,
  });
});

// Combined Unified Monitoring Endpoint
app.get("/api/devices/monitoring", (_req: Request, res: Response) => {
  res.json({
    devices: [
      {
        device_id: "ac_simulator",
        device_name: "Living Room AC (1.5 Ton)",
        device_type: "ac_simulator",
        latest_telemetry: telemetryBuffer.ac_simulator[telemetryBuffer.ac_simulator.length - 1] || null,
        history: telemetryBuffer.ac_simulator,
        health: deviceHealth.ac_simulator,
        simulator_state: acSimulatorState,
      },
      {
        device_id: "laptop_primary",
        device_name: "Primary User Laptop",
        device_type: "laptop",
        latest_telemetry: telemetryBuffer.laptop_primary[telemetryBuffer.laptop_primary.length - 1] || null,
        history: telemetryBuffer.laptop_primary,
        health: deviceHealth.laptop_primary,
      },
    ],
    service_tickets: autoServiceTickets,
  });
});

// Mistral AI Explanation Proxy Endpoint
app.post("/api/ai/mistral/explain", async (req: Request, res: Response) => {
  const { prompt, context } = req.body;
  if (!prompt && !context) {
    res.status(400).json({ detail: "Prompt or context required." });
    return;
  }

  const promptText = prompt || `Analyze energy metrics context: ${JSON.stringify(context)}`;
  const explanation = await callMistralAI(promptText);
  res.json({
    explanation: explanation || "Mistral AI analysis completed based on real-time device telemetry.",
  });
});

// Service Tickets API Endpoints
app.get("/api/service-tickets", (_req: Request, res: Response) => {
  res.json(autoServiceTickets);
});

app.get("/api/service-tickets/provider/:providerId", (req: Request, res: Response) => {
  const pId = parseInt(req.params.providerId, 10);
  const tickets = autoServiceTickets.filter((t) => t.provider_id === pId);
  res.json(tickets);
});

app.put("/api/service-tickets/:ticketId/status", (req: Request, res: Response) => {
  const tId = parseInt(req.params.ticketId, 10);
  const ticket = autoServiceTickets.find((t) => t.id === tId);
  if (!ticket) {
    res.status(404).json({ detail: "Ticket not found" });
    return;
  }
  ticket.status = req.body.status || ticket.status;

  // Sync back to serviceRequests array as well
  const reqItem = serviceRequests.find((r) => r.id === tId);
  if (reqItem) {
    reqItem.status = ticket.status === "Auto-Created" ? "Pending" : ticket.status;
  }

  res.json(ticket);
});

// Fallback 404 for undefined /api routes
app.all("/api/{*all}", (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    detail: `API endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// ============================================================
// Vite Middleware & Static Frontend Server (Port 3000)
// ============================================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("{*all}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Household Energy Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

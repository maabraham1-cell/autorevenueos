'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const RECOVERY_RATE = 0.35;
const PER_BOOKING_FEE = 3;
const SETUP_FEE = 49;
const WEEKS_PER_MONTH = 4.33;

const INDUSTRIES = [
  'Beauty / Salon',
  'Dental',
  'Healthcare Clinic',
  'Fitness / Wellness',
  'Trades / Local Services',
  'Professional Services',
  'Other',
];

function AnimatedNumber({ value }: { value: number }) {
  const [flashKey, setFlashKey] = useState(0);

  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

  return (
    <motion.span
      key={flashKey + formatted}
      initial={{ backgroundColor: '#ffffff' }}
      animate={{ backgroundColor: '#fef08a' }}
      transition={{ duration: 0.18 }}
      onUpdate={() => {
        // bump key to retrigger animation when value changes
        setFlashKey((k) => k + 1);
      }}
      style={{ padding: '0 4px', borderRadius: '4px' }}
    >
      {formatted}
    </motion.span>
  );
}

export function RevenueCalculator() {
  const [missedCallsPerWeek, setMissedCallsPerWeek] = useState<number>(0);
  const [averageBookingValue, setAverageBookingValue] = useState<number>(0);
  const [industry, setIndustry] = useState<string>('Dental');

  const monthlyCalls = missedCallsPerWeek * WEEKS_PER_MONTH;
  const revenueAtRisk = monthlyCalls * averageBookingValue;
  const recoveredRevenue = revenueAtRisk * RECOVERY_RATE;
  const recoveredBookings = monthlyCalls * RECOVERY_RATE;
  const monthlySetup = SETUP_FEE / 12;
  const fees = recoveredBookings * PER_BOOKING_FEE + monthlySetup;
  const netProfit = Math.max(0, recoveredRevenue - fees);

  return (
    <div
      style={{
        width: '100%',
        margin: '0',
        padding: '0',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '18px' }}>
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#64748B',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            AutoRevenueOS
          </div>
          <h2
            style={{
              margin: '0',
              fontSize: '28px',
              lineHeight: 1.2,
              fontWeight: 700,
              color: '#0F172A',
            }}
          >
            Free Revenue Check
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              color: '#475569',
              fontSize: '15px',
              lineHeight: 1.5,
            }}
          >
            Estimate what missed calls are costing you — using a fixed{' '}
            <strong>35%</strong> industry recovery rate.
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '22px',
            marginTop: '18px',
          }}
        >
          {/* LEFT: Inputs */}
          <div>
            {/* Missed Calls */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  Missed calls per week
                </label>
                <div
                  style={{
                    background: 'rgba(59,130,246,.12)',
                    border: '1px solid rgba(59,130,246,.25)',
                    color: '#1D4ED8',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    fontWeight: 700,
                    fontSize: '13px',
                    minWidth: '44px',
                    textAlign: 'center',
                  }}
                >
                  {missedCallsPerWeek}
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="120"
                value={missedCallsPerWeek}
                onChange={(e) => setMissedCallsPerWeek(Number(e.target.value))}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  accentColor: '#3B82F6',
                  cursor: 'pointer',
                  height: '6px',
                  borderRadius: '999px',
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${
                    (missedCallsPerWeek / 120) * 100
                  }%, #E5E7EB ${(missedCallsPerWeek / 120) * 100}%, #E5E7EB 100%)`,
                }}
              />
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                Range: 1–120 (adjust later if you want)
              </div>
            </div>

            {/* Booking Value */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  marginBottom: '8px',
                }}
              >
                Average booking value (£)
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    fontWeight: 700,
                  }}
                >
                  £
                </span>
                <input
                  type="number"
                  min="10"
                  step="5"
                  placeholder="0"
                  value={averageBookingValue === 0 ? '' : averageBookingValue}
                  onChange={(e) =>
                    setAverageBookingValue(Math.max(0, Number(e.target.value)))
                  }
                  style={{
                    width: '100%',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '12px 14px 12px 28px',
                    fontSize: '16px',
                    color: '#0F172A',
                    outline: 'none',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                Tip: use your average treatment spend.
              </div>
            </div>

            {/* Industry */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  marginBottom: '8px',
                }}
              >
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  fontSize: '16px',
                  color: '#0F172A',
                  outline: 'none',
                  background: '#fff',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Pricing Note */}
            <div
              style={{
                marginTop: '16px',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: '#0F172A',
                  fontSize: '13px',
                  marginBottom: '8px',
                }}
              >
                Pricing used in this estimate
              </div>
              <div
                style={{
                  margin: '0',
                  color: '#334155',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <div>
                  Setup fee: <strong>£49</strong> (one-time)
                </div>
                <div>
                  Per recovered booking: <strong>£3</strong>
                </div>
                <div>
                  Recovery rate: <strong>35%</strong> (fixed industry standard)
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Results */}
          <div>
            {/* Revenue at Risk */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderLeft: '4px solid #F59E0B',
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: 600,
                  letterSpacing: '.02em',
                  textTransform: 'uppercase',
                }}
              >
                Monthly revenue at risk
              </div>
              <div
                style={{
                  fontSize: '32px',
                  lineHeight: 1.1,
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: '6px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <AnimatedNumber value={revenueAtRisk} />
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                Based on missed calls × booking value.
              </div>
            </div>

            {/* Recovered Revenue */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderLeft: '4px solid #22C55E',
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: 600,
                  letterSpacing: '.02em',
                  textTransform: 'uppercase',
                }}
              >
                Estimated recovered revenue
              </div>
              <div
                style={{
                  fontSize: '32px',
                  lineHeight: 1.1,
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: '6px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <AnimatedNumber value={recoveredRevenue} />
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                We use 35% recovery rate.
              </div>
            </div>

            {/* Net Profit */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderLeft: '4px solid #3B82F6',
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: 600,
                  letterSpacing: '.02em',
                  textTransform: 'uppercase',
                }}
              >
                Estimated net profit (monthly)
              </div>
              <div
                style={{
                  fontSize: '32px',
                  lineHeight: 1.1,
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: '6px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <AnimatedNumber value={netProfit} />
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                After £3/booking fee + setup fee (amortised).
              </div>
            </div>

            {/* CTA Button */}
            <button
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '10px',
                padding: '16px 28px',
                background: '#3B82F6',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                marginTop: '10px',
                filter: 'brightness(1)',
                transition: 'filter .15s ease',
              }}
            >
              See My Lost Revenue
            </button>
            <div
              style={{
                textAlign: 'center',
                color: '#64748B',
                fontSize: '12px',
                marginTop: '10px',
              }}
            >
              No spam. We'll use your answers to tailor the setup.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import type { ScenarioConfig } from './types';
import { DEFAULT_WEIGHTS } from './types';

// ─── Shared runways for KBLR scenarios ────────────────────────────────────────
// KBLR = Kempegowda International Airport, Bangalore
// Two parallel E-W runway pairs (09/27 headings)

const KBLR_RUNWAYS = [
  {
    id: 'rwy-09L',
    designation: '09L',
    lengthM: 4000,
    canHandleHeavy: true,
    canHandleMedium: true,
    approachHeadingDeg: 90,
    positionAngleDeg: 270,
    gateTerminals: ['A', 'B'],
  },
  {
    id: 'rwy-27R',
    designation: '27R',
    lengthM: 4000,
    canHandleHeavy: true,
    canHandleMedium: true,
    approachHeadingDeg: 270,
    positionAngleDeg: 90,
    gateTerminals: ['A', 'B'],
  },
  {
    id: 'rwy-09R',
    designation: '09R',
    lengthM: 3500,
    canHandleHeavy: false,
    canHandleMedium: true,
    approachHeadingDeg: 90,
    positionAngleDeg: 270,
    gateTerminals: ['C'],
  },
  {
    id: 'rwy-27L',
    designation: '27L',
    lengthM: 3500,
    canHandleHeavy: false,
    canHandleMedium: true,
    approachHeadingDeg: 270,
    positionAngleDeg: 90,
    gateTerminals: ['C'],
  },
];

// ─── KBLR_PEAK: 4 aircraft, 4 runways (balanced) ─────────────────────────────
export const KBLR_PEAK: ScenarioConfig = {
  id: 'KBLR_PEAK',
  name: 'KBLR PEAK OPS',
  description: 'Balanced 4×4 — demonstrates standard Hungarian minimisation',
  mode: 'min',
  weights: DEFAULT_WEIGHTS,
  runways: [...KBLR_RUNWAYS],
  aircraft: [
    {
      id: 'ac-1',
      callsign: 'AI-203',
      category: 'HEAVY',
      fuelPercent: 62,
      altitude: 8000,
      speedKts: 250,
      headingDeg: 225,        // heading SW toward airport (reciprocal of 045°)
      positionAngleDeg: 45,   // NE — bearing 045° from KBLR
      distanceNM: 35,
      preferredGate: 'A4',
    },
    {
      id: 'ac-2',
      callsign: '6E-1142',
      category: 'MEDIUM',
      fuelPercent: 79,
      altitude: 6000,
      speedKts: 218,
      headingDeg: 135,        // heading SE toward airport (reciprocal of 315°)
      positionAngleDeg: 315,  // NW — bearing 315° from KBLR
      distanceNM: 28,
      preferredGate: 'B2',
    },
    {
      id: 'ac-3',
      callsign: 'UK-215',
      category: 'MEDIUM',
      fuelPercent: 27,        // amber — low fuel
      altitude: 5000,
      speedKts: 235,
      headingDeg: 0,          // heading north toward airport (reciprocal of 180°)
      positionAngleDeg: 180,  // S — bearing 180° from KBLR
      distanceNM: 40,
      preferredGate: 'C1',
    },
    {
      id: 'ac-4',
      callsign: 'IX-543',
      category: 'LIGHT',
      fuelPercent: 8,         // red — critical fuel
      altitude: 3500,
      speedKts: 182,
      headingDeg: 260,        // heading W toward airport (reciprocal of 080°)
      positionAngleDeg: 80,   // E — bearing 080°, nearly aligned with 09R approach (090°)
      distanceNM: 45,         // farthest aircraft — goes last in naive FCFS, gets worst runway
      preferredGate: 'A1',
    },
  ],
};

// ─── KBLR_SURGE: 6 aircraft, 3 runways (unbalanced — dummy cols) ──────────────
export const KBLR_SURGE: ScenarioConfig = {
  id: 'KBLR_SURGE',
  name: 'KBLR SURGE',
  description: '6 aircraft, 3 runways — 3 planes enter holding (dummy cols)',
  mode: 'min',
  weights: DEFAULT_WEIGHTS,
  runways: KBLR_RUNWAYS.slice(0, 3),
  aircraft: [
    {
      id: 'ac-1',
      callsign: 'AI-203',
      category: 'HEAVY',
      fuelPercent: 55,
      altitude: 8000,
      speedKts: 250,
      headingDeg: 220,
      positionAngleDeg: 42,
      distanceNM: 26,
      preferredGate: 'A4',
    },
    {
      id: 'ac-2',
      callsign: '6E-1142',
      category: 'MEDIUM',
      fuelPercent: 72,
      altitude: 6000,
      speedKts: 218,
      headingDeg: 138,
      positionAngleDeg: 318,
      distanceNM: 19,
      preferredGate: 'B2',
    },
    {
      id: 'ac-3',
      callsign: 'UK-215',
      category: 'MEDIUM',
      fuelPercent: 31,
      altitude: 5000,
      speedKts: 235,
      headingDeg: 352,
      positionAngleDeg: 172,
      distanceNM: 32,
      preferredGate: 'C1',
    },
    {
      id: 'ac-4',
      callsign: 'IX-543',
      category: 'LIGHT',
      fuelPercent: 11,
      altitude: 3500,
      speedKts: 182,
      headingDeg: 268,
      positionAngleDeg: 92,
      distanceNM: 13,
      preferredGate: 'A1',
    },
    {
      id: 'ac-5',
      callsign: 'SG-414',
      category: 'MEDIUM',
      fuelPercent: 48,
      altitude: 7000,
      speedKts: 240,
      headingDeg: 300,
      positionAngleDeg: 240,
      distanceNM: 22,
      preferredGate: 'B3',
    },
    {
      id: 'ac-6',
      callsign: 'QP-881',
      category: 'LIGHT',
      fuelPercent: 66,
      altitude: 5500,
      speedKts: 195,
      headingDeg: 20,
      positionAngleDeg: 20,
      distanceNM: 28,
      preferredGate: 'C2',
    },
  ],
};

// ─── KBLR_CRISIS: 5 aircraft, 4 runways — THE wow-moment scenario ─────────────
// Two planes critically low on fuel. In Naive mode one crashes.
// In Hungarian mode the critical plane gets the nearest compatible runway.
export const KBLR_CRISIS: ScenarioConfig = {
  id: 'KBLR_CRISIS',
  name: 'KBLR CRISIS',
  description: '5×4 unbalanced — low-fuel planes crash in Naive, saved in Hungarian',
  mode: 'min',
  weights: { ...DEFAULT_WEIGHTS, fuelRisk: 0.55, approachDistance: 0.25 },
  runways: [...KBLR_RUNWAYS],
  aircraft: [
    {
      id: 'ac-1',
      callsign: 'AI-203',
      category: 'HEAVY',
      fuelPercent: 58,
      altitude: 8000,
      speedKts: 250,
      headingDeg: 220,
      positionAngleDeg: 42,
      distanceNM: 26,
      preferredGate: 'A4',
    },
    {
      id: 'ac-2',
      callsign: '6E-1142',
      category: 'MEDIUM',
      fuelPercent: 6,         // CRITICAL — must land immediately
      altitude: 2500,
      speedKts: 210,
      headingDeg: 268,
      positionAngleDeg: 85,   // close, almost due east
      distanceNM: 8,
      preferredGate: 'B2',
    },
    {
      id: 'ac-3',
      callsign: 'UK-215',
      category: 'MEDIUM',
      fuelPercent: 41,
      altitude: 5000,
      speedKts: 235,
      headingDeg: 352,
      positionAngleDeg: 172,
      distanceNM: 29,
      preferredGate: 'C1',
    },
    {
      id: 'ac-4',
      callsign: 'IX-543',
      category: 'LIGHT',
      fuelPercent: 7,         // CRITICAL — second emergency
      altitude: 2000,
      speedKts: 180,
      headingDeg: 180,
      positionAngleDeg: 355,  // almost due north, close
      distanceNM: 10,
      preferredGate: 'A1',
    },
    {
      id: 'ac-5',
      callsign: 'SG-414',
      category: 'MEDIUM',
      fuelPercent: 52,
      altitude: 7000,
      speedKts: 240,
      headingDeg: 300,
      positionAngleDeg: 240,
      distanceNM: 22,
      preferredGate: 'B3',
    },
  ],
};

// ─── KBLR_DEGEN: engineered degeneracy ───────────────────────────────────────
export const KBLR_DEGEN: ScenarioConfig = {
  id: 'KBLR_DEGEN',
  name: 'KBLR DEGEN',
  description: '4×4 — engineered tie in line covering, multiple optimal solutions',
  mode: 'min',
  weights: DEFAULT_WEIGHTS,
  runways: [...KBLR_RUNWAYS],
  aircraft: [
    {
      id: 'ac-1',
      callsign: 'AI-101',
      category: 'HEAVY',
      fuelPercent: 50,
      altitude: 7000,
      speedKts: 245,
      headingDeg: 225,
      positionAngleDeg: 45,
      distanceNM: 20,
      preferredGate: 'A1',
    },
    {
      id: 'ac-2',
      callsign: '6E-202',
      category: 'MEDIUM',
      fuelPercent: 50,
      altitude: 7000,
      speedKts: 220,
      headingDeg: 135,
      positionAngleDeg: 315,
      distanceNM: 20,
      preferredGate: 'B1',
    },
    {
      id: 'ac-3',
      callsign: 'UK-303',
      category: 'MEDIUM',
      fuelPercent: 50,
      altitude: 7000,
      speedKts: 230,
      headingDeg: 315,
      positionAngleDeg: 135,
      distanceNM: 20,
      preferredGate: 'C1',
    },
    {
      id: 'ac-4',
      callsign: 'SG-404',
      category: 'LIGHT',
      fuelPercent: 50,
      altitude: 7000,
      speedKts: 185,
      headingDeg: 45,
      positionAngleDeg: 225,
      distanceNM: 20,
      preferredGate: 'A2',
    },
  ],
};

// ─── PROFIT_DEMO: 3×3 maximisation ───────────────────────────────────────────
export const PROFIT_DEMO: ScenarioConfig = {
  id: 'PROFIT_DEMO',
  name: 'PROFIT DEMO',
  description: '3×3 maximisation — shows profit-to-cost conversion step',
  mode: 'max',
  weights: DEFAULT_WEIGHTS,
  runways: KBLR_RUNWAYS.slice(0, 3),
  aircraft: [
    {
      id: 'ac-1',
      callsign: 'AI-001',
      category: 'HEAVY',
      fuelPercent: 70,
      altitude: 8000,
      speedKts: 250,
      headingDeg: 220,
      positionAngleDeg: 42,
      distanceNM: 20,
      preferredGate: 'A4',
    },
    {
      id: 'ac-2',
      callsign: '6E-002',
      category: 'MEDIUM',
      fuelPercent: 65,
      altitude: 6000,
      speedKts: 218,
      headingDeg: 138,
      positionAngleDeg: 318,
      distanceNM: 18,
      preferredGate: 'B2',
    },
    {
      id: 'ac-3',
      callsign: 'UK-003',
      category: 'MEDIUM',
      fuelPercent: 60,
      altitude: 5000,
      speedKts: 235,
      headingDeg: 352,
      positionAngleDeg: 172,
      distanceNM: 25,
      preferredGate: 'C1',
    },
  ],
};

export const ALL_SCENARIOS: ScenarioConfig[] = [
  KBLR_PEAK,
  KBLR_SURGE,
  KBLR_CRISIS,
  KBLR_DEGEN,
  PROFIT_DEMO,
];

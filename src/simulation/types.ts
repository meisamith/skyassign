// ─── Aircraft ─────────────────────────────────────────────────────────────────

export type AircraftCategory = 'HEAVY' | 'MEDIUM' | 'LIGHT';

export interface Aircraft {
  id: string;
  callsign: string;           // e.g. "AI-203", "6E-1142"
  category: AircraftCategory;
  fuelPercent: number;        // 0–100, current fuel level
  altitude: number;           // feet MSL
  speedKts: number;           // knots groundspeed
  headingDeg: number;         // magnetic heading, 0–360
  positionAngleDeg: number;   // angular position on the approach circle, 0–360
  distanceNM: number;         // nautical miles from airport centre
  preferredGate: string;      // first char = terminal (A/B/C), e.g. "A3"
  isDummy?: boolean;
}

// ─── Runway ───────────────────────────────────────────────────────────────────

export interface Runway {
  id: string;
  designation: string;        // e.g. "09L", "27R", "14"
  lengthM: number;            // runway length in metres
  canHandleHeavy: boolean;
  canHandleMedium: boolean;
  approachHeadingDeg: number; // compass heading of the approach end
  positionAngleDeg: number;   // angle on the airport diagram, for SVG placement
  gateTerminals: string[];    // terminals served (e.g. ["A","B"])
  isDummy?: boolean;
}

// ─── Cost weights ─────────────────────────────────────────────────────────────
// C[i][j] = w1*fuelRisk + w2*approachDist + w3*incompatibility + w4*gatePenalty
// Each term normalised 0–100 before weighting.

export interface CostWeights {
  fuelRisk: number;           // w1 = 0.4 default
  approachDistance: number;   // w2 = 0.3 default
  incompatibility: number;    // w3 = 0.2 default
  gatePenalty: number;        // w4 = 0.1 default
}

export const DEFAULT_WEIGHTS: CostWeights = {
  fuelRisk: 0.4,
  approachDistance: 0.3,
  incompatibility: 0.2,
  gatePenalty: 0.1,
};

// ─── Scenario ─────────────────────────────────────────────────────────────────

export type ScenarioId =
  | 'KBLR_PEAK'
  | 'KBLR_SURGE'
  | 'KBLR_DEGEN'
  | 'KBLR_CRISIS'
  | 'PROFIT_DEMO';

export interface ScenarioConfig {
  id: ScenarioId;
  name: string;
  description: string;
  aircraft: Aircraft[];
  runways: Runway[];
  weights: CostWeights;
  mode: 'min' | 'max';
}

// ─── Assignment result ────────────────────────────────────────────────────────

export interface AssignmentEntry {
  aircraft: Aircraft;
  runway: Runway;
  cost: number;              // composite cost (0 for dummy pairs)
  isHolding: boolean;        // plane assigned to dummy runway (holding pattern)
  isIdle: boolean;           // dummy plane assigned to real runway (runway idle)
}

// ─── Cost cell breakdown (for HUD tooltip + viva explainability) ──────────────

export interface CostBreakdown {
  fuelRisk: number;          // 0–100, raw component score
  approachDistance: number;
  incompatibility: number;
  gatePenalty: number;
  weighted: {
    fuelRisk: number;
    approachDistance: number;
    incompatibility: number;
    gatePenalty: number;
  };
  total: number;             // final integer cost in the matrix
}

// ─── Simulation state ─────────────────────────────────────────────────────────

export type SimMode = 'naive' | 'optimal';
export type SimPhase = 'idle' | 'running' | 'stepping' | 'complete';

export interface SimulationMetrics {
  totalCost: number;
  crashes: number;            // planes that ran out of fuel before landing
  totalDelayMin: number;      // total holding time in minutes
  fuelWastedPct: number;      // average extra fuel burned vs optimal
  holdingCount: number;       // planes currently in holding pattern
}

export interface SimulationState {
  scenario: ScenarioConfig;
  mode: SimMode;
  phase: SimPhase;
  assignments: AssignmentEntry[];
  currentHungarianStep: number; // index into steps[] array during step-mode
  metrics: SimulationMetrics;
}

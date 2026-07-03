/**
 * Composite cost matrix builder.
 *
 * C[i][j] = w1·fuelRisk(i) + w2·approachDistance(i,j)
 *          + w3·incompatibility(i,j) + w4·gatePenalty(i,j)
 *
 * Every component is normalised to [0, 100] before weighting,
 * so the formula is directly interpretable in the UI and in viva.
 *
 * Weights (w1=0.4, w2=0.3, w3=0.2, w4=0.1) are explicit constants —
 * any cell can be traced back to exactly these four inputs.
 */

import type { Aircraft, CostBreakdown, CostWeights, Runway } from '@/simulation/types';
import { DEFAULT_WEIGHTS } from '@/simulation/types';

// ─── Component functions ──────────────────────────────────────────────────────

/**
 * fuelRisk: aircraft with low fuel must land soon → high cost if delayed.
 * Score = 100 − fuelPercent  (0% fuel → score 100, full tank → score 0)
 */
function fuelRiskScore(aircraft: Aircraft): number {
  return Math.max(0, Math.min(100, 100 - aircraft.fuelPercent));
}

/**
 * approachDistance: angular separation between the aircraft's current position
 * on the approach circle and the runway's approach heading.
 * Score = (angularDiff / 180) * 100  where angularDiff ∈ [0, 180]
 */
function approachDistanceScore(aircraft: Aircraft, runway: Runway): number {
  const diff = Math.abs(aircraft.positionAngleDeg - runway.approachHeadingDeg);
  const angularDiff = Math.min(diff, 360 - diff); // shortest arc, 0–180
  return (angularDiff / 180) * 100;
}

/**
 * incompatibility: penalty when the aircraft weight category exceeds runway limits.
 * HEAVY on non-HEAVY runway → 100.
 * MEDIUM on non-MEDIUM runway → 50.
 * Compatible → 0.
 */
function incompatibilityScore(aircraft: Aircraft, runway: Runway): number {
  if (aircraft.category === 'HEAVY' && !runway.canHandleHeavy) return 100;
  if (aircraft.category === 'MEDIUM' && !runway.canHandleMedium) return 50;
  return 0;
}

/**
 * gatePenalty: if the aircraft's preferred terminal is not served by this runway,
 * passengers face a long taxi/transfer — minor cost contributor.
 * Score = 0 if terminal served, 50 if not (partial penalty for sub-optimal gate).
 */
function gatePenaltyScore(aircraft: Aircraft, runway: Runway): number {
  const terminal = aircraft.preferredGate.charAt(0).toUpperCase();
  return runway.gateTerminals.includes(terminal) ? 0 : 50;
}

// ─── Public builder ───────────────────────────────────────────────────────────

export interface CostMatrixResult {
  matrix: number[][];
  breakdown: CostBreakdown[][];
  formula: string; // human-readable formula string for display in UI
}

export function buildCostMatrix(
  aircraft: Aircraft[],
  runways: Runway[],
  weights: CostWeights = DEFAULT_WEIGHTS
): CostMatrixResult {
  const matrix: number[][] = [];
  const breakdown: CostBreakdown[][] = [];

  for (let i = 0; i < aircraft.length; i++) {
    matrix[i] = [];
    breakdown[i] = [];

    for (let j = 0; j < runways.length; j++) {
      const plane = aircraft[i];
      const runway = runways[j];

      // Raw component scores (0–100 each)
      const fuel = fuelRiskScore(plane);
      const dist = approachDistanceScore(plane, runway);
      const incompat = incompatibilityScore(plane, runway);
      const gate = gatePenaltyScore(plane, runway);

      // Weighted sum — result rounded to integer for clean matrix display
      const total = Math.round(
        weights.fuelRisk * fuel +
        weights.approachDistance * dist +
        weights.incompatibility * incompat +
        weights.gatePenalty * gate
      );

      matrix[i][j] = total;

      breakdown[i][j] = {
        fuelRisk: fuel,
        approachDistance: dist,
        incompatibility: incompat,
        gatePenalty: gate,
        weighted: {
          fuelRisk: Math.round(weights.fuelRisk * fuel),
          approachDistance: Math.round(weights.approachDistance * dist),
          incompatibility: Math.round(weights.incompatibility * incompat),
          gatePenalty: Math.round(weights.gatePenalty * gate),
        },
        total,
      };
    }
  }

  const formula =
    `C[i][j] = ${weights.fuelRisk}·fuelRisk + ` +
    `${weights.approachDistance}·approachDist + ` +
    `${weights.incompatibility}·incompatibility + ` +
    `${weights.gatePenalty}·gatePenalty`;

  return { matrix, breakdown, formula };
}

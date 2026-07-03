/**
 * Naive FCFS algorithm — greedy by design.
 * Same cost matrix as Hungarian, worse choices.
 * This is the OR proof: same input, worse output.
 */

import type { Aircraft, Runway, CostWeights } from '@/simulation/types';
import { DEFAULT_WEIGHTS } from '@/simulation/types';
import { buildCostMatrix } from '@/lib/hungarian/cost-matrix';
import type { Matrix, ZeroCell } from '@/lib/hungarian/types';

export interface NaiveResult {
  assignment: number[];         // assignment[i] = j: aircraft i → runway j
  assignmentPairs: ZeroCell[];  // (aircraftIdx, runwayIdx) pairs
  totalCost: number;
  perAircraftCost: number[];    // cost per aircraft index
  originalMatrix: Matrix;
  sortedOrder: number[];        // aircraft indices in FCFS order (ascending distanceNM)
  naivePickSequence: Array<{
    aircraftIndex: number;
    runwayIndex: number;
    cost: number;
    pickOrder: number;          // 1-based order in which this pick was made
  }>;
  crashedAircraftIndices: number[];
  mode: 'NAIVE';
}

// Crash if angular mismatch between aircraft position and runway approach
// demands more maneuvering fuel than remains.
// 180° mismatch → 15% fuel required; 0° mismatch → 0% fuel required.
const CRASH_ANGULAR_FUEL_FACTOR = 15;

function angularDelta(posAngle: number, approachHeading: number): number {
  const diff = Math.abs(posAngle - approachHeading);
  return Math.min(diff, 360 - diff); // shortest arc, 0–180°
}

export function wouldCrash(ac: Aircraft, runway: Runway): boolean {
  const delta = angularDelta(ac.positionAngleDeg, runway.approachHeadingDeg);
  const fuelRequired = (delta / 180) * CRASH_ANGULAR_FUEL_FACTOR;
  return ac.fuelPercent < fuelRequired;
}

export function solveNaive(
  aircraft: Aircraft[],
  runways: Runway[],
  weights: CostWeights = DEFAULT_WEIGHTS,
): NaiveResult {
  const { matrix } = buildCostMatrix(aircraft, runways, weights);

  // FCFS: closest aircraft first (ascending distanceNM)
  const sortedOrder = [...aircraft.keys()].sort(
    (a, b) => aircraft[a].distanceNM - aircraft[b].distanceNM,
  );

  const assignment = new Array(aircraft.length).fill(-1);
  const usedRunways = new Set<number>();
  const naivePickSequence: NaiveResult['naivePickSequence'] = [];
  const perAircraftCost = new Array(aircraft.length).fill(0);
  let totalCost = 0;
  let pickOrder = 1;

  for (const acIdx of sortedOrder) {
    let bestRwyIdx = -1;
    let bestCost = Infinity;

    for (let rwyIdx = 0; rwyIdx < runways.length; rwyIdx++) {
      if (usedRunways.has(rwyIdx)) continue;
      const cost = matrix[acIdx][rwyIdx];
      if (cost < bestCost) {
        bestCost = cost;
        bestRwyIdx = rwyIdx;
      }
    }

    if (bestRwyIdx !== -1) {
      assignment[acIdx] = bestRwyIdx;
      usedRunways.add(bestRwyIdx);
      perAircraftCost[acIdx] = bestCost;
      totalCost += bestCost;
      naivePickSequence.push({
        aircraftIndex: acIdx,
        runwayIndex: bestRwyIdx,
        cost: bestCost,
        pickOrder: pickOrder++,
      });
    }
  }

  const assignmentPairs: ZeroCell[] = assignment
    .map((rwyIdx, acIdx) => [acIdx, rwyIdx] as ZeroCell)
    .filter(([, rwyIdx]) => rwyIdx !== -1);

  const crashedAircraftIndices: number[] = [];
  for (const [acIdx, rwyIdx] of assignmentPairs) {
    if (acIdx < aircraft.length && rwyIdx < runways.length) {
      if (wouldCrash(aircraft[acIdx], runways[rwyIdx])) {
        crashedAircraftIndices.push(acIdx);
      }
    }
  }

  return {
    assignment,
    assignmentPairs,
    totalCost,
    perAircraftCost,
    originalMatrix: matrix,
    sortedOrder,
    naivePickSequence,
    crashedAircraftIndices,
    mode: 'NAIVE',
  };
}

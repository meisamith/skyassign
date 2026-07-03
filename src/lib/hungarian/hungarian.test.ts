/**
 * Unit tests for the Hungarian Algorithm implementation.
 * Run with:  npx tsx --test src/lib/hungarian/hungarian.test.ts
 *
 * Test cases are derived from Taha, "Operations Research: An Introduction" and
 * standard Indian OR textbooks (Hillier-Lieberman). Expected values are
 * hand-verified below each matrix.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveMin, solveMax } from './hungarian.js';

// ─── TC1: Taha 4×4 Minimization ──────────────────────────────────────────────
// Source: Taha, "Operations Research", Chapter 5 (Assignment Problem)
//
//         M1   M2   M3   M4
//  J1  [  9,   2,   7,   8 ]  row min = 2
//  J2  [  6,   4,   3,   7 ]  row min = 3
//  J3  [  5,   8,   1,   8 ]  row min = 1
//  J4  [  7,   6,   9,   4 ]  row min = 4
//
//  After row reduction (subtract row mins):
//    7  0  5  6
//    3  1  0  4
//    4  7  0  7
//    3  2  5  0
//
//  After col reduction (col mins: 3, 0, 0, 0):
//    4  0  5  6
//    0  1  0  4
//    1  7  0  7
//    0  2  5  0
//
//  Zeros: (0,1)(1,0)(1,2)(2,2)(3,0)(3,3)
//  Unique max matching (row 0 & 2 forced): (0,1)(1,0)(2,2)(3,3) → 4 lines = n
//  No adjustment step needed.
//
//  Optimal: J1→M2 (2) + J2→M1 (6) + J3→M3 (1) + J4→M4 (4) = 13

describe('TC1 — Taha 4×4 minimisation (no adjustment step)', () => {
  const matrix = [
    [9, 2, 7, 8],
    [6, 4, 3, 7],
    [5, 8, 1, 8],
    [7, 6, 9, 4],
  ];

  const result = solveMin(matrix);

  it('total cost = 13', () => {
    assert.equal(result.totalCost, 13);
  });

  it('assignment: J1→M2(col1), J2→M1(col0), J3→M3(col2), J4→M4(col3)', () => {
    assert.equal(result.assignment[0], 1);
    assert.equal(result.assignment[1], 0);
    assert.equal(result.assignment[2], 2);
    assert.equal(result.assignment[3], 3);
  });

  it('step 1 row mins = [2, 3, 1, 4]', () => {
    const s1 = result.steps.find(s => s.step === 1)!;
    assert.deepEqual(s1.rowMins, [2, 3, 1, 4]);
  });

  it('step 1 reduced matrix is correct', () => {
    const s1 = result.steps.find(s => s.step === 1)!;
    assert.deepEqual(s1.matrix, [
      [7, 0, 5, 6],
      [3, 1, 0, 4],
      [4, 7, 0, 7],
      [3, 2, 5, 0],
    ]);
  });

  it('step 2 col mins = [3, 0, 0, 0]', () => {
    const s2 = result.steps.find(s => s.step === 2)!;
    assert.deepEqual(s2.colMins, [3, 0, 0, 0]);
  });

  it('step 2 reduced matrix is correct', () => {
    const s2 = result.steps.find(s => s.step === 2)!;
    assert.deepEqual(s2.matrix, [
      [4, 0, 5, 6],
      [0, 1, 0, 4],
      [1, 7, 0, 7],
      [0, 2, 5, 0],
    ]);
  });

  it('step 3: 4 lines = n, no adjustment needed', () => {
    const s3 = result.steps.find(s => s.step === 3)!;
    assert.equal(s3.lineCount, 4);
    assert.equal(s3.needsAdjustment, false);
  });

  it('no step 4 (adjustment) in trace', () => {
    const adjustSteps = result.steps.filter(s => s.step === 4);
    assert.equal(adjustSteps.length, 0);
  });

  it('step trace order: 1 → 2 → 3 → 5', () => {
    const stepNums = result.steps.map(s => s.step);
    assert.deepEqual(stepNums, [1, 2, 3, 5]);
  });

  it('no dummy rows or cols (balanced)', () => {
    assert.equal(result.dummies.rows, 0);
    assert.equal(result.dummies.cols, 0);
  });
});


// ─── TC2: 3×3 requiring exactly one adjustment step ─────────────────────────
// Hand-derived problem specifically engineered to exercise Step 4.
//
//         R0   R1   R2
//  P0  [  8,   4,   7 ]  row min = 4
//  P1  [  5,   2,   3 ]  row min = 2
//  P2  [  9,   4,   8 ]  row min = 4
//
//  After row reduction:
//    4  0  3
//    3  0  1
//    5  0  4
//
//  After col reduction (col mins: 3, 0, 1):
//    1  0  2
//    0  0  0
//    2  0  3
//
//  Zeros at (0,1)(1,0)(1,1)(1,2)(2,1)
//  Max matching: {(0,1),(1,0)} or {(0,1),(1,2)} — size 2 < n=3
//  König lines (from matching {(0,1),(1,0)}):
//    Unmatched row: 2 → Z_rows={2}
//    Row 2 zeros at col 1 → Z_cols={1}
//    matchCol[1]=0 (row 0) → Z_rows={0,2}
//    Lines: row 1 (not in Z_rows) + col 1 (in Z_cols) = 2 lines
//  Min uncovered h = 1  (e.g. cell (0,0)=1)
//
//  After adjustment:
//    0  0  1
//    0  1  0
//    1  0  2
//
//  New max matching: {(0,0),(1,2),(2,1)} — size 3 = n.  Done.
//  Optimal: P0→R0 (8) + P1→R2 (3) + P2→R1 (4) = 15

describe('TC2 — 3×3 minimisation with one adjustment step', () => {
  const matrix = [
    [8, 4, 7],
    [5, 2, 3],
    [9, 4, 8],
  ];

  const result = solveMin(matrix);

  it('total cost = 15', () => {
    assert.equal(result.totalCost, 15);
  });

  it('assignment: P0→R0(col0), P1→R2(col2), P2→R1(col1)', () => {
    assert.equal(result.assignment[0], 0);
    assert.equal(result.assignment[1], 2);
    assert.equal(result.assignment[2], 1);
  });

  it('exactly one adjustment step (step 4)', () => {
    const s4 = result.steps.filter(s => s.step === 4);
    assert.equal(s4.length, 1);
  });

  it('adjustment value h = 1', () => {
    const s4 = result.steps.find(s => s.step === 4)!;
    assert.equal(s4.adjustValue, 1);
  });

  it('step trace order: 1 → 2 → 3 → 4 → 3 → 5', () => {
    const stepNums = result.steps.map(s => s.step);
    assert.deepEqual(stepNums, [1, 2, 3, 4, 3, 5]);
  });

  it('first step 3 reports needsAdjustment=true, second reports false', () => {
    const s3s = result.steps.filter(s => s.step === 3);
    assert.equal(s3s[0].needsAdjustment, true);
    assert.equal(s3s[1].needsAdjustment, false);
  });

  it('matrix after adjustment is correct', () => {
    const s4 = result.steps.find(s => s.step === 4)!;
    assert.deepEqual(s4.matrix, [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 2],
    ]);
  });
});


// ─── TC3: Unbalanced (3 planes, 4 runways) ───────────────────────────────────
// 3×4 input → padded to 4×4 with one dummy row (cost 0 = "runway idle").
//
// Optimal assigns 3 real planes and leaves one runway idle (dummy).

describe('TC3 — unbalanced 3 planes × 4 runways (dummy row)', () => {
  const matrix = [
    [10, 20, 30, 40],
    [25, 15, 35, 45],
    [35, 25, 15, 20],
  ];

  const result = solveMin(matrix);

  it('adds 1 dummy row, 0 dummy cols', () => {
    assert.equal(result.dummies.rows, 1);
    assert.equal(result.dummies.cols, 0);
  });

  it('padded matrix is 4×4', () => {
    assert.equal(result.paddedMatrix.length, 4);
    assert.equal(result.paddedMatrix[0].length, 4);
  });

  it('dummy row is all zeros', () => {
    assert.deepEqual(result.paddedMatrix[3], [0, 0, 0, 0]);
  });

  it('3 real planes each get a distinct runway', () => {
    const realPairs = result.assignmentPairs.filter(([r]) => r < 3);
    assert.equal(realPairs.length, 3);
    const cols = realPairs.map(([, c]) => c);
    assert.equal(new Set(cols).size, 3, 'Each runway assigned at most once');
  });

  it('total cost counts only real assignments', () => {
    // Manually verify: optimal for these numbers
    // Row 0→col 0 (10), Row 1→col 1 (15), Row 2→col 2 (15) = 40
    // (dummy row gets whatever runway is left)
    assert.equal(result.totalCost, 40);
  });
});


// ─── TC4: Unbalanced (5 planes, 3 runways) ───────────────────────────────────
// 5×3 input → padded to 5×5 with 2 dummy cols (cost 0 = "holding pattern").

describe('TC4 — unbalanced 5 planes × 3 runways (dummy cols / holding)', () => {
  const matrix = [
    [10, 30, 20],
    [20, 10, 30],
    [30, 20, 10],
    [25, 15, 35],
    [35, 25, 15],
  ];

  const result = solveMin(matrix);

  it('adds 0 dummy rows, 2 dummy cols', () => {
    assert.equal(result.dummies.rows, 0);
    assert.equal(result.dummies.cols, 2);
  });

  it('padded matrix is 5×5', () => {
    assert.equal(result.paddedMatrix.length, 5);
    assert.equal(result.paddedMatrix[0].length, 5);
  });

  it('each real runway assigned to exactly 1 plane', () => {
    const realPairs = result.assignmentPairs.filter(([, c]) => c < 3);
    assert.equal(realPairs.length, 3);
    const cols = realPairs.map(([, c]) => c);
    assert.equal(new Set(cols).size, 3);
  });

  it('2 planes assigned to dummy (holding) cols', () => {
    const holdingPairs = result.assignmentPairs.filter(([, c]) => c >= 3);
    assert.equal(holdingPairs.length, 2);
  });
});


// ─── TC5: Maximization variant ───────────────────────────────────────────────
// 3×3 profit matrix. solveMax must convert C'[i][j] = max(C) - C[i][j],
// then minimise C', giving the maximum-profit assignment.
//
//          R0   R1   R2
//  P0  [   4,   6,   3 ]
//  P1  [   9,   2,   1 ]
//  P2  [   3,   5,   8 ]
//
//  max = 9  →  C'[i][j] = 9 - C[i][j]:
//    5  3  6
//    0  7  8
//    6  4  1
//
//  After row reduction (mins: 3,0,1): 2 0 3 / 0 7 8 / 5 3 0
//  After col reduction (mins: 0,0,0): unchanged
//  Zeros at (0,1)(1,0)(2,2) — distinct rows+cols → 3 lines = n. Done.
//  Assignment: P0→R1 (profit 6) + P1→R0 (profit 9) + P2→R2 (profit 8) = 23
//
//  All 6 permutations: max is indeed 6+9+8=23.

describe('TC5 — 3×3 maximisation variant', () => {
  const matrix = [
    [4, 6, 3],
    [9, 2, 1],
    [3, 5, 8],
  ];

  const result = solveMax(matrix);

  it('mode is max', () => {
    assert.equal(result.mode, 'max');
  });

  it('maxValue = 9', () => {
    assert.equal(result.maxValue, 9);
  });

  it('converted matrix is correct (C′ = 9 - C)', () => {
    assert.deepEqual(result.convertedMatrix, [
      [5, 3, 6],
      [0, 7, 8],
      [6, 4, 1],
    ]);
  });

  it('total profit = 23 (maximum possible)', () => {
    assert.equal(result.totalCost, 23);
  });

  it('assignment: P0→R1(col1), P1→R0(col0), P2→R2(col2)', () => {
    assert.equal(result.assignment[0], 1);
    assert.equal(result.assignment[1], 0);
    assert.equal(result.assignment[2], 2);
  });

  it('no adjustment step needed', () => {
    assert.equal(result.steps.filter(s => s.step === 4).length, 0);
  });
});


// ─── TC6: Degenerate (multiple zeros after reduction, tie in line covering) ──
// Engineered to produce ties in the assignment step to ensure the algorithm
// still finds a complete valid assignment (any of the optimal solutions).

describe('TC6 — degeneracy (multiple valid optimal assignments)', () => {
  // Symmetric cost: any diagonal permutation has cost 3*k.
  // The algorithm must find ONE complete assignment — not crash or miss rows.
  const matrix = [
    [2, 2, 3],
    [2, 3, 2],
    [3, 2, 2],
  ];

  const result = solveMin(matrix);

  it('total cost = 6 (all optimal assignments have cost 2+2+2)', () => {
    assert.equal(result.totalCost, 6);
  });

  it('assignment is complete (all 3 rows assigned distinct cols)', () => {
    const cols = result.assignment;
    assert.equal(cols.length, 3);
    assert.equal(new Set(cols.filter(c => c !== -1)).size, 3);
  });
});

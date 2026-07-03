/**
 * Standalone verification script for the proposed TC1 5×5 matrix.
 * Run with: npx tsx src/lib/hungarian/verify-tc1.ts
 *
 * Reports:
 *  1. solveMin() output — assignment, cost, step trace
 *  2. Brute-force enumeration of all 5! = 120 permutations — true minimum
 *  3. Match/mismatch verdict
 *  4. Whether Step 4 (matrix adjustment) was triggered
 */

import { solveMin } from './hungarian.js';

const matrix = [
  //  R0   R1   R2   R3   R4
  [  6,  12,   3,  11,  15 ], // A
  [  4,   2,   7,   1,  10 ], // B
  [  8,  11,  10,   7,  11 ], // C
  [ 16,  19,  12,  23,  21 ], // D
  [  9,   5,   7,   6,  10 ], // E
];

const rowLabels = ['A', 'B', 'C', 'D', 'E'];
const colLabels = ['R0', 'R1', 'R2', 'R3', 'R4'];

// ─── 1. Hungarian algorithm ───────────────────────────────────────────────────

console.log('═══════════════════════════════════════════');
console.log('  INPUT MATRIX');
console.log('═══════════════════════════════════════════');
console.log('       ' + colLabels.join('   '));
matrix.forEach((row, i) => {
  console.log(`  ${rowLabels[i]}  [${row.map(v => String(v).padStart(3)).join(', ')} ]`);
});

const result = solveMin(matrix);

console.log('\n═══════════════════════════════════════════');
console.log('  HUNGARIAN ALGORITHM OUTPUT');
console.log('═══════════════════════════════════════════');
console.log(`  Total cost    : ${result.totalCost}`);
console.log('  Assignment    :');
result.assignmentPairs.forEach(([r, c]) => {
  const cost = matrix[r][c];
  console.log(`    ${rowLabels[r]} → ${colLabels[c]}  (cost ${cost})`);
});

console.log('\n  Step trace    :');
result.steps.forEach(s => {
  const adj = s.step === 4 ? `  ← h = ${s.adjustValue}` : '';
  const note = s.step === 3 ? `  [lines=${s.lineCount}, needsAdj=${s.needsAdjustment}]` : '';
  console.log(`    Step ${s.step} iter${s.iterationIndex}  ${s.label}${adj}${note}`);
});

const step4Count = result.steps.filter(s => s.step === 4).length;
console.log(`\n  Step 4 triggered: ${step4Count > 0 ? `YES (${step4Count}x)` : 'NO'}`);

// ─── 2. Brute-force enumeration ───────────────────────────────────────────────

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

const n = matrix.length;
const allPerms = permutations([0, 1, 2, 3, 4]);
let bfMin = Infinity;
const bfBest: number[][] = [];

for (const perm of allPerms) {
  let cost = 0;
  for (let row = 0; row < n; row++) {
    cost += matrix[row][perm[row]];
  }
  if (cost < bfMin) {
    bfMin = cost;
    bfBest.length = 0;
    bfBest.push(perm);
  } else if (cost === bfMin) {
    bfBest.push(perm);
  }
}

console.log('\n═══════════════════════════════════════════');
console.log('  BRUTE-FORCE ENUMERATION (5! = 120 perms)');
console.log('═══════════════════════════════════════════');
console.log(`  True minimum cost : ${bfMin}`);
console.log(`  Optimal assignment(s) found: ${bfBest.length}`);
bfBest.forEach((perm, idx) => {
  const pairs = perm.map((c, r) => `${rowLabels[r]}→${colLabels[c]}(${matrix[r][c]})`).join(', ');
  console.log(`  [${idx + 1}] ${pairs}  = ${perm.reduce((s, c, r) => s + matrix[r][c], 0)}`);
});

// ─── 3. Verdict ───────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log('  VERDICT');
console.log('═══════════════════════════════════════════');

const hungarianCost = result.totalCost;
const hungarianAssignment = result.assignment; // assignment[row] = col

const hungarianIsOptimal = bfBest.some(perm =>
  perm.every((col, row) => col === hungarianAssignment[row])
);

console.log(`  Hungarian cost    = ${hungarianCost}`);
console.log(`  Brute-force min   = ${bfMin}`);
console.log(`  Costs match       : ${hungarianCost === bfMin ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Assignment in BF  : ${hungarianIsOptimal ? 'YES ✓' : `NO — but cost matches: ${hungarianCost === bfMin}`}`);
console.log(`  Step 4 exercised  : ${step4Count > 0 ? 'YES ✓' : 'NO ✗ — different matrix needed'}`);

if (hungarianCost === bfMin && step4Count > 0) {
  console.log('\n  RESULT: ✓ PASS — cost verified, Step 4 triggered. Safe to use as TC1.');
} else if (hungarianCost !== bfMin) {
  console.log('\n  RESULT: ✗ FAIL — cost mismatch. Algorithm has a bug.');
} else {
  console.log('\n  RESULT: ✗ STEP 4 NOT TRIGGERED — swap matrix for one that requires adjustment.');
}

import type { HungarianResult, Line, Matrix, StepTrace, ZeroCell } from './types';

// ─── Utilities ────────────────────────────────────────────────────────────────

function cloneMatrix(m: Matrix): Matrix {
  return m.map(row => [...row]);
}

function zerosOf(matrix: Matrix): boolean[][] {
  return matrix.map(row => row.map(val => val === 0));
}

// ─── Bipartite Maximum Matching (augmenting-path DFS) ────────────────────────
// Returns matchRow[i] = j if row i is matched to col j, -1 if unmatched.
// This is the core subroutine used by both line-covering (König) and final assignment.

function maxBipartiteMatching(zeros: boolean[][], n: number): number[] {
  const matchRow = new Array<number>(n).fill(-1);
  const matchCol = new Array<number>(n).fill(-1);

  function augment(row: number, visited: boolean[]): boolean {
    for (let col = 0; col < n; col++) {
      if (!zeros[row][col] || visited[col]) continue;
      visited[col] = true;
      // If col is free or its current row can be rerouted, take it
      if (matchCol[col] === -1 || augment(matchCol[col], visited)) {
        matchRow[row] = col;
        matchCol[col] = row;
        return true;
      }
    }
    return false;
  }

  for (let row = 0; row < n; row++) {
    augment(row, new Array<boolean>(n).fill(false));
  }

  return matchRow;
}

// ─── Step 3: Minimum Line Cover via König's Theorem ──────────────────────────
// Returns the minimum set of lines (rows/cols) that cover all zeros,
// along with the current best assignment (matchRow) used to derive the cover.

function minLineCover(
  matrix: Matrix,
  n: number
): { lines: Line[]; matchRow: number[] } {
  const zeros = zerosOf(matrix);
  const matchRow = maxBipartiteMatching(zeros, n);

  // Build reverse map: matchCol[j] = i if col j is matched to row i
  const matchCol = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (matchRow[i] !== -1) matchCol[matchRow[i]] = i;
  }

  // König's theorem: alternating reachability from unmatched rows
  const Z_rows = new Set<number>();
  const Z_cols = new Set<number>();

  for (let i = 0; i < n; i++) {
    if (matchRow[i] === -1) Z_rows.add(i);
  }

  // BFS alternating traversal
  const rowQueue = [...Z_rows];
  while (rowQueue.length > 0) {
    const row = rowQueue.shift()!;
    for (let col = 0; col < n; col++) {
      if (zeros[row][col] && !Z_cols.has(col)) {
        Z_cols.add(col);
        // Follow matched edge from col back to a row
        if (matchCol[col] !== -1 && !Z_rows.has(matchCol[col])) {
          Z_rows.add(matchCol[col]);
          rowQueue.push(matchCol[col]);
        }
      }
    }
  }

  // Minimum vertex cover = rows NOT in Z_rows  ∪  cols IN Z_cols
  const lines: Line[] = [];
  for (let i = 0; i < n; i++) {
    if (!Z_rows.has(i)) lines.push({ type: 'row', index: i });
  }
  for (let j = 0; j < n; j++) {
    if (Z_cols.has(j)) lines.push({ type: 'col', index: j });
  }

  return { lines, matchRow };
}

// ─── Solver ───────────────────────────────────────────────────────────────────

export function solveMin(originalMatrix: Matrix): HungarianResult {
  const steps: StepTrace[] = [];
  const nRows = originalMatrix.length;
  const nCols = originalMatrix[0].length;

  // ── Pad to square with dummy zeros ──────────────────────────────────────────
  const dummies = { rows: 0, cols: 0 };
  let paddedMatrix: Matrix;

  if (nRows > nCols) {
    // More planes than runways → add dummy columns (holding patterns)
    dummies.cols = nRows - nCols;
    paddedMatrix = originalMatrix.map(row => [
      ...row,
      ...new Array<number>(dummies.cols).fill(0),
    ]);
  } else if (nCols > nRows) {
    // More runways than planes → add dummy rows (idle runways)
    dummies.rows = nCols - nRows;
    const dummyRows = Array.from({ length: dummies.rows }, () =>
      new Array<number>(nCols).fill(0)
    );
    paddedMatrix = [...originalMatrix.map(r => [...r]), ...dummyRows];
  } else {
    paddedMatrix = originalMatrix.map(r => [...r]);
  }

  const n = paddedMatrix.length;
  let matrix = cloneMatrix(paddedMatrix);

  // ── Step 1: Row Reduction ────────────────────────────────────────────────────
  const rowMins = matrix.map(row => Math.min(...row));
  matrix = matrix.map((row, i) => row.map(val => val - rowMins[i]));

  steps.push({
    step: 1,
    label: 'Row Reduction',
    description:
      'Subtract the minimum element in each row from every element in that row. ' +
      'Guarantees at least one zero per row.',
    matrix: cloneMatrix(matrix),
    iterationIndex: 0,
    rowMins,
  });

  // ── Step 2: Column Reduction ─────────────────────────────────────────────────
  const colMins: number[] = Array.from({ length: n }, (_, j) =>
    Math.min(...matrix.map(row => row[j]))
  );
  matrix = matrix.map(row => row.map((val, j) => val - colMins[j]));

  steps.push({
    step: 2,
    label: 'Column Reduction',
    description:
      'Subtract the minimum element in each column from every element in that column. ' +
      'Guarantees at least one zero per column.',
    matrix: cloneMatrix(matrix),
    iterationIndex: 0,
    colMins,
  });

  // ── Steps 3–4 Loop ───────────────────────────────────────────────────────────
  let iteration = 0;

  while (true) {
    iteration++;
    const { lines, matchRow: prelimMatch } = minLineCover(matrix, n);

    // Collect assigned zeros for visualisation
    const markedZeros: ZeroCell[] = prelimMatch
      .map((col, row): ZeroCell => [row, col])
      .filter(([, col]) => col !== -1);

    const needsAdjustment = lines.length < n;

    steps.push({
      step: 3,
      label: 'Cover Zeros',
      description:
        `Minimum lines to cover all zeros: ${lines.length}. ` +
        (needsAdjustment
          ? `Less than n=${n} — adjustment required (Step 4).`
          : `Equals n=${n} — optimal assignment exists (Step 5).`),
      matrix: cloneMatrix(matrix),
      iterationIndex: iteration,
      coveredLines: lines,
      markedZeros,
      lineCount: lines.length,
      needsAdjustment,
    });

    if (!needsAdjustment) break;

    // ── Step 4: Matrix Adjustment ──────────────────────────────────────────────
    const coveredRows = new Set(
      lines.filter(l => l.type === 'row').map(l => l.index)
    );
    const coveredCols = new Set(
      lines.filter(l => l.type === 'col').map(l => l.index)
    );

    const uncoveredCells: ZeroCell[] = [];
    const doubleCoveredCells: ZeroCell[] = [];
    let adjustValue = Infinity;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const inRow = coveredRows.has(i);
        const inCol = coveredCols.has(j);
        if (!inRow && !inCol) {
          uncoveredCells.push([i, j]);
          if (matrix[i][j] < adjustValue) adjustValue = matrix[i][j];
        } else if (inRow && inCol) {
          doubleCoveredCells.push([i, j]);
        }
      }
    }

    matrix = matrix.map((row, i) =>
      row.map((val, j) => {
        const inRow = coveredRows.has(i);
        const inCol = coveredCols.has(j);
        if (!inRow && !inCol) return val - adjustValue;
        if (inRow && inCol) return val + adjustValue;
        return val;
      })
    );

    steps.push({
      step: 4,
      label: 'Matrix Adjustment',
      description:
        `Subtract h=${adjustValue} from all uncovered elements; ` +
        `add h=${adjustValue} to doubly-covered intersections. ` +
        'Singly-covered elements are unchanged.',
      matrix: cloneMatrix(matrix),
      iterationIndex: iteration,
      adjustValue,
      uncoveredCells,
      doubleCoveredCells,
    });
  }

  // ── Step 5: Optimal Assignment ───────────────────────────────────────────────
  const { matchRow: finalMatch } = minLineCover(matrix, n);

  const assignmentPairs: ZeroCell[] = finalMatch
    .map((col, row): ZeroCell => [row, col])
    .filter(([, col]) => col !== -1);

  // Cost from real (non-dummy) pairs only
  let totalCost = 0;
  for (const [row, col] of assignmentPairs) {
    if (row < nRows && col < nCols) {
      totalCost += originalMatrix[row][col];
    }
  }

  steps.push({
    step: 5,
    label: 'Optimal Assignment',
    description:
      'Select one zero per row and column using maximum bipartite matching. ' +
      'Each assigned pair (i, j) maps an aircraft to a runway at minimum total cost.',
    matrix: cloneMatrix(matrix),
    iterationIndex: iteration,
    assignment: assignmentPairs,
    markedZeros: assignmentPairs,
  });

  return {
    steps,
    assignment: finalMatch,
    assignmentPairs,
    totalCost,
    originalMatrix,
    paddedMatrix,
    dummies,
    mode: 'min',
  };
}

// ─── Maximization Variant ────────────────────────────────────────────────────
// Classic conversion: C'[i][j] = maxVal - C[i][j], then minimize C'.
// The UI must show this conversion step explicitly (viva question).

export function solveMax(originalMatrix: Matrix): HungarianResult {
  const maxValue = Math.max(...originalMatrix.flat());
  const convertedMatrix: Matrix = originalMatrix.map(row =>
    row.map(val => maxValue - val)
  );

  const result = solveMin(convertedMatrix);

  // Recalculate total cost against the original profit matrix
  let totalCost = 0;
  const nRows = originalMatrix.length;
  const nCols = originalMatrix[0].length;
  for (const [row, col] of result.assignmentPairs) {
    if (row < nRows && col < nCols) {
      totalCost += originalMatrix[row][col];
    }
  }

  return {
    ...result,
    totalCost,
    originalMatrix,
    mode: 'max',
    maxValue,
    convertedMatrix,
  };
}

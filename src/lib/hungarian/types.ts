export type Matrix = number[][];

export interface Line {
  type: 'row' | 'col';
  index: number;
}

export type ZeroCell = [number, number]; // [row, col]

export interface StepTrace {
  step: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  matrix: Matrix;
  iterationIndex: number; // how many times we've looped through steps 3-4
  // Step 1
  rowMins?: number[];
  // Step 2
  colMins?: number[];
  // Step 3
  coveredLines?: Line[];
  markedZeros?: ZeroCell[];
  lineCount?: number;
  needsAdjustment?: boolean;
  // Step 4
  adjustValue?: number;
  doubleCoveredCells?: ZeroCell[];
  uncoveredCells?: ZeroCell[];
  // Step 5
  assignment?: ZeroCell[];
}

export interface HungarianResult {
  steps: StepTrace[];
  assignment: number[];           // assignment[i] = j: row i assigned to col j (-1 if dummy)
  assignmentPairs: ZeroCell[];    // explicit (row, col) pairs including dummies
  totalCost: number;              // cost from real (non-dummy) pairs only
  originalMatrix: Matrix;
  paddedMatrix: Matrix;           // square matrix after dummy padding
  dummies: {
    rows: number;                 // dummy rows added (excess runways)
    cols: number;                 // dummy cols added (excess aircraft)
  };
  mode: 'min' | 'max';
  maxValue?: number;              // max value used for conversion in max mode
  convertedMatrix?: Matrix;       // C'[i][j] = maxVal - C[i][j] in max mode
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { HungarianResult, StepTrace } from '@/lib/hungarian/types';
import type { Aircraft, Runway } from '@/simulation/types';
import type { NaiveResult } from '@/lib/naive/naive-fcfs';

const CELL_W   = 50;
const CELL_H   = 24;
const LABEL_W  = 62;
const HEADER_H = 22;
const ANNO_W   = 30;

interface Props {
  aircraft: Aircraft[];
  runways:  Runway[];
  result:   HungarianResult | null;
  /** -1 = idle, 0 = original matrix, 1..steps.length = step trace */
  currentStep: number;
  // Naive mode props
  naiveMode?:   boolean;
  naiveResult?: NaiveResult | null;
}

export default function MatrixPanel({
  aircraft, runways, result, currentStep,
  naiveMode = false, naiveResult = null,
}: Props) {
  const nRows = aircraft.length;
  const nCols = runways.length;

  // ── Naive animation: which pick index is currently being highlighted ───────
  const [naiveAnimIdx, setNaiveAnimIdx] = useState(-1);

  useEffect(() => {
    if (!naiveMode || !naiveResult) { setNaiveAnimIdx(-1); return; }
    setNaiveAnimIdx(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    naiveResult.naivePickSequence.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setNaiveAnimIdx(i < naiveResult.naivePickSequence.length - 1 ? i + 1 : -1);
      }, (i + 1) * 380));
    });
    return () => timers.forEach(clearTimeout);
  }, [naiveMode, naiveResult]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hungarian mode: trace & matrix ─────────────────────────────────────────
  const trace: StepTrace | null =
    result && currentStep >= 1 && currentStep <= result.steps.length
      ? result.steps[currentStep - 1]
      : null;

  const rawMatrix = !result ? null
    : currentStep === 0 || !trace ? result.originalMatrix
    : trace.matrix;

  const displayMatrix = naiveMode
    ? (naiveResult?.originalMatrix.slice(0, nRows).map(r => r.slice(0, nCols)) ?? null)
    : rawMatrix?.slice(0, nRows).map(row => row.slice(0, nCols)) ?? null;

  // ── Flash cells on change ──────────────────────────────────────────────────
  const prevRef = useRef<number[][] | null>(null);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!displayMatrix) { prevRef.current = null; return; }
    const flashing = new Set<string>();
    if (prevRef.current) {
      for (let r = 0; r < nRows; r++)
        for (let c = 0; c < nCols; c++)
          if (prevRef.current[r]?.[c] !== displayMatrix[r]?.[c])
            flashing.add(`${r},${c}`);
    }
    prevRef.current = displayMatrix.map(row => [...row]);
    if (flashing.size === 0) return;
    setFlashCells(flashing);
    const t = setTimeout(() => setFlashCells(new Set()), 700);
    return () => clearTimeout(t);
  }, [displayMatrix]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sequential row/col animation (Hungarian steps 1/2) ────────────────────
  const [animRow, setAnimRow] = useState(-2);
  useEffect(() => {
    if (!trace || trace.step !== 1) { setAnimRow(-2); return; }
    setAnimRow(0);
    const timers = Array.from({ length: nRows }, (_, r) =>
      setTimeout(() => setAnimRow(r + 1 < nRows ? r + 1 : -1), (r + 1) * 260)
    );
    return () => timers.forEach(clearTimeout);
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const [animCol, setAnimCol] = useState(-2);
  useEffect(() => {
    if (!trace || trace.step !== 2) { setAnimCol(-2); return; }
    setAnimCol(0);
    const timers = Array.from({ length: nCols }, (_, c) =>
      setTimeout(() => setAnimCol(c + 1 < nCols ? c + 1 : -1), (c + 1) * 260)
    );
    return () => timers.forEach(clearTimeout);
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell style resolver ────────────────────────────────────────────────────
  function cellStyle(r: number, c: number, val: number): React.CSSProperties {
    // ── Naive mode cell styles ────────────────────────────────────────────
    if (naiveMode && naiveResult) {
      const picks = naiveResult.naivePickSequence;
      const lockedPicks = naiveAnimIdx === -1 ? picks : picks.slice(0, naiveAnimIdx);
      const activePick  = naiveAnimIdx >= 0 && naiveAnimIdx < picks.length
        ? picks[naiveAnimIdx] : null;

      // Currently animating (amber flash)
      if (activePick?.aircraftIndex === r && activePick?.runwayIndex === c) {
        return {
          background: 'rgba(255,182,39,0.45)',
          color: '#ffb627',
          animation: 'naivePickFlash 0.38s ease-out',
        };
      }

      // Locked greedy pick
      const isLocked = lockedPicks.some(p => p.aircraftIndex === r && p.runwayIndex === c);
      if (isLocked) {
        const isCrash = naiveResult.crashedAircraftIndices.includes(r);
        return {
          background: isCrash ? 'rgba(255,59,59,0.18)' : 'rgba(255,182,39,0.12)',
          color: isCrash ? '#ff3b3b' : '#ffb627',
          outline: `1.5px solid ${isCrash ? 'rgba(255,59,59,0.8)' : 'rgba(255,182,39,0.7)'}`,
          outlineOffset: '-1.5px',
          fontWeight: 700,
        };
      }

      return {};
    }

    // ── Hungarian mode cell styles ────────────────────────────────────────
    if (!trace) return {};
    const { step, rowMins, colMins, markedZeros, assignment, uncoveredCells, doubleCoveredCells } = trace;

    if (step === 1 && rowMins) {
      const done   = animRow === -1 || animRow > r;
      const active = animRow === r;
      if (done && val === 0 && (rowMins[r] ?? 0) > 0)
        return { background: 'rgba(255,182,39,0.22)', color: '#ffb627' };
      if (active)
        return { background: 'rgba(255,182,39,0.09)' };
    }

    if (step === 2 && colMins) {
      const done   = animCol === -1 || animCol > c;
      const active = animCol === c;
      if (done && val === 0 && (colMins[c] ?? 0) > 0)
        return { background: 'rgba(255,182,39,0.22)', color: '#ffb627' };
      if (active)
        return { background: 'rgba(255,182,39,0.09)' };
    }

    if (step === 3) {
      const isMark = markedZeros?.some(([mr, mc]) => mr === r && mc === c);
      if (isMark) return { background: 'rgba(0,255,156,0.28)', color: '#00ff9c', fontWeight: 700 };
      if (val === 0) return { background: 'rgba(0,255,156,0.1)', color: '#00ff9c' };
    }

    if (step === 4) {
      if (uncoveredCells?.some(([ur, uc]) => ur === r && uc === c))
        return { background: 'rgba(255,59,59,0.2)', color: '#ff3b3b' };
      if (doubleCoveredCells?.some(([dr, dc]) => dr === r && dc === c))
        return { background: 'rgba(74,214,255,0.15)', color: '#4ad6ff' };
    }

    if (step === 5 && assignment) {
      if (assignment.some(([ar, ac]) => ar === r && ac === c))
        return {
          background: 'rgba(0,255,156,0.2)',
          color: '#00ff9c',
          outline: '1.5px solid rgba(0,255,156,0.85)',
          outlineOffset: '-1.5px',
          fontWeight: 700,
        };
      if (val === 0) return { color: '#5a6478', opacity: 0.55 };
    }

    return {};
  }

  const coverLines    = trace?.step === 3 ? (trace.coveredLines ?? []) : [];
  const showRowAnno   = trace?.step === 1;
  const showColAnno   = trace?.step === 2 && (trace.colMins?.some(m => m > 0) ?? false);
  const matrixW       = LABEL_W + nCols * CELL_W + (showRowAnno ? ANNO_W : 0);

  // ── Idle state ─────────────────────────────────────────────────────────────
  if (!result && !naiveResult) {
    return (
      <div className="border border-atc-border">
        <div className="text-[7px] text-atc-scope-dim uppercase tracking-[0.3em] text-center py-6 opacity-50">
          Matrix idle — press RUN to solve
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Matrix grid ──────────────────────────────────────────────────────── */}
      <div className="relative" style={{ width: matrixW }}>

        {/* Header row */}
        <div className="flex" style={{ height: HEADER_H }}>
          <div style={{ width: LABEL_W }} />
          {runways.slice(0, nCols).map((rwy, c) => {
            const lineCol = coverLines.some(l => l.type === 'col' && l.index === c);
            return (
              <div key={rwy.id}
                style={{ width: CELL_W, height: HEADER_H }}
                className="flex items-center justify-center text-[7px] font-mono tracking-wider border-b border-atc-border/40"
              >
                <span className={lineCol ? 'text-atc-scope font-bold' : 'text-atc-scope-dim'}>
                  {rwy.designation}
                </span>
              </div>
            );
          })}
          {showRowAnno && <div style={{ width: ANNO_W }} />}
        </div>

        {/* Data rows */}
        {displayMatrix?.map((row, r) => {
          const lineRow   = coverLines.some(l => l.type === 'row' && l.index === r);
          const rowActive = trace?.step === 1 && animRow === r;

          return (
            <div key={r} className="flex" style={{ height: CELL_H }}>
              <div style={{ width: LABEL_W, height: CELL_H }}
                className={`flex items-center pr-2 text-[7px] font-mono truncate transition-colors ${
                  naiveMode
                    ? naiveResult?.crashedAircraftIndices.includes(r)
                      ? 'text-atc-warn'
                      : 'text-atc-mute'
                    : rowActive ? 'text-atc-amber' : lineRow ? 'text-atc-scope' : 'text-atc-mute'
                }`}
                title={aircraft[r]?.callsign}
              >
                <span className="truncate">{aircraft[r]?.callsign}</span>
              </div>

              {row.map((val, c) => {
                const style  = cellStyle(r, c, val);
                const flash  = flashCells.has(`${r},${c}`);
                return (
                  <div key={c}
                    style={{
                      width: CELL_W,
                      height: CELL_H,
                      transition: 'background 0.35s, color 0.25s',
                      ...style,
                      ...(flash ? { animation: 'matrixFlash 0.65s ease-out' } : {}),
                    }}
                    className="flex items-center justify-center text-[8.5px] font-mono border border-atc-border/25"
                  >
                    {val}
                  </div>
                );
              })}

              {showRowAnno && (animRow === -1 || animRow > r) && (trace?.rowMins?.[r] ?? 0) > 0 && (
                <div style={{ width: ANNO_W, height: CELL_H }}
                  className="flex items-center pl-1.5 text-[7px] font-mono text-atc-amber"
                >
                  −{trace!.rowMins![r]}
                </div>
              )}
            </div>
          );
        })}

        {/* Col annotations (step 2) */}
        {showColAnno && (
          <div className="flex" style={{ height: CELL_H }}>
            <div style={{ width: LABEL_W }} />
            {trace!.colMins!.slice(0, nCols).map((min, c) => {
              const shown = animCol === -1 || animCol > c;
              return (
                <div key={c}
                  style={{ width: CELL_W, height: CELL_H }}
                  className="flex items-center justify-center text-[7px] font-mono text-atc-amber"
                >
                  {shown && min > 0 ? `−${min}` : ''}
                </div>
              );
            })}
          </div>
        )}

        {/* Covering line overlays (step 3) */}
        {coverLines.map((line, i) =>
          line.type === 'row' ? (
            <div key={i} style={{
              position: 'absolute',
              top: HEADER_H + line.index * CELL_H + CELL_H / 2 - 0.75,
              left: LABEL_W,
              width: nCols * CELL_W,
              height: 1.5,
              background: 'var(--color-atc-scope)',
              boxShadow: '0 0 5px var(--color-atc-scope)',
              opacity: 0.8,
              pointerEvents: 'none',
            }} />
          ) : (
            <div key={i} style={{
              position: 'absolute',
              left: LABEL_W + line.index * CELL_W + CELL_W / 2 - 0.75,
              top: HEADER_H,
              width: 1.5,
              height: nRows * CELL_H,
              background: 'var(--color-atc-scope)',
              boxShadow: '0 0 5px var(--color-atc-scope)',
              opacity: 0.8,
              pointerEvents: 'none',
            }} />
          )
        )}
      </div>

      {/* ── Banners ───────────────────────────────────────────────────────────── */}

      {/* Naive mode annotation */}
      {naiveMode && naiveResult && (
        <div className="mt-2 space-y-[3px]">
          {naiveAnimIdx === -1 && (
            <div className="text-[7px] font-mono text-atc-amber tracking-wider uppercase">
              GREEDY PICK · NOT OPTIMAL
            </div>
          )}
          {/* Naive assignment table */}
          {naiveAnimIdx === -1 && (
            <div className="mt-2 border-t border-atc-border/40 pt-2 space-y-[3px]">
              {naiveResult.naivePickSequence.map(({ aircraftIndex, runwayIndex, cost, pickOrder }) => {
                if (aircraftIndex >= aircraft.length || runwayIndex >= runways.length) return null;
                const ac  = aircraft[aircraftIndex];
                const rwy = runways[runwayIndex];
                const isCrash = naiveResult.crashedAircraftIndices.includes(aircraftIndex);
                return (
                  <div key={aircraftIndex}
                    className={`flex items-center gap-1.5 text-[7.5px] font-mono ${isCrash ? 'text-atc-warn' : ''}`}
                  >
                    <span className="text-atc-mute opacity-60" style={{ minWidth: 14 }}>{pickOrder}.</span>
                    <span className={isCrash ? 'text-atc-warn' : 'text-atc-hud'} style={{ minWidth: 56 }}>
                      {ac.callsign}
                    </span>
                    <span className={isCrash ? 'text-atc-warn' : 'text-atc-amber-dim'}>→</span>
                    <span className={`font-bold ${isCrash ? 'text-atc-warn' : 'text-atc-amber'}`}
                      style={{ minWidth: 28 }}>
                      {rwy.designation}
                    </span>
                    <span className="text-atc-mute ml-auto">cost {cost}</span>
                    {isCrash && <span className="text-atc-warn text-[6.5px]">⚠ CRASH</span>}
                  </div>
                );
              })}
              <div className="border-t border-atc-border/40 mt-1 pt-1.5 flex items-center gap-2">
                <span className="text-[7px] font-mono uppercase tracking-widest text-atc-mute">Total</span>
                <span className="text-[11px] font-mono font-bold text-atc-amber"
                  style={{ textShadow: '0 0 6px var(--color-atc-amber)' }}>
                  {naiveResult.totalCost}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hungarian step banners */}
      {!naiveMode && trace?.step === 3 && (
        <div className={`mt-1.5 text-[7px] font-mono ${trace.needsAdjustment ? 'text-atc-amber' : 'text-atc-scope'}`}>
          Lines = {trace.lineCount} / {Math.min(nRows, nCols)}
          {trace.needsAdjustment ? ' — adjustment needed' : ' — optimal exists ✓'}
        </div>
      )}

      {!naiveMode && trace?.step === 4 && trace.adjustValue !== undefined && (
        <div className="mt-1.5 text-[7px] font-mono text-atc-amber">
          h = {trace.adjustValue} · uncovered cells −h · intersections +h
        </div>
      )}

      {/* Step 5: assignment table */}
      {!naiveMode && trace?.step === 5 && result && trace.assignment && (
        <div className="mt-3 border-t border-atc-border/40 pt-2 space-y-[3px]">
          {trace.assignment.map(([row, col]) => {
            if (row >= nRows || col >= nCols) return null;
            const ac  = aircraft[row];
            const rwy = runways[col];
            const cost = result.originalMatrix[row]?.[col] ?? 0;
            return (
              <div key={row} className="flex items-center gap-1.5 text-[7.5px] font-mono">
                <span className="text-atc-hud" style={{ minWidth: 56 }}>{ac.callsign}</span>
                <span className="text-atc-scope-dim">→</span>
                <span className="text-atc-scope font-bold" style={{ minWidth: 28 }}>{rwy.designation}</span>
                <span className="text-atc-mute ml-auto">cost {cost}</span>
              </div>
            );
          })}
          <div className="border-t border-atc-border/40 mt-1 pt-1.5 flex items-center gap-2">
            <span className="text-[7px] font-mono uppercase tracking-widest text-atc-mute">Total</span>
            <span className="text-[11px] font-mono font-bold text-atc-scope glow-scope">
              {result.totalCost}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

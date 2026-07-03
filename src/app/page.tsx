'use client';

import { useCallback, useEffect, useState } from 'react';
import AnimatedRadarScope from '@/components/radar/AnimatedRadarScopeClient';
import SystemClock from '@/components/hud/SystemClock';
import RunControls from '@/components/controls/RunControls';
import MatrixPanel from '@/components/hud/MatrixPanel';
import { KBLR_PEAK } from '@/simulation/scenarios';
import { buildCostMatrix } from '@/lib/hungarian/cost-matrix';
import { solveMin, solveMax } from '@/lib/hungarian/hungarian';
import { solveNaive } from '@/lib/naive/naive-fcfs';
import type { HungarianResult } from '@/lib/hungarian/types';
import type { NaiveResult } from '@/lib/naive/naive-fcfs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SolverState {
  result:        HungarianResult;
  currentStep:   number;
  isAutoPlaying: boolean;
}

type AppMode = 'hungarian' | 'naive';

type ComparePhase =
  | 'idle'
  | 'p1-naive'
  | 'p1-done'
  | 'p2-hungarian'
  | 'complete';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_NAMES = [
  'Row Reduction',
  'Column Reduction',
  'Cover Zeros',
  'Adjust Matrix (h)',
  'Optimal Assignment',
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const scenario = KBLR_PEAK;

  // Hungarian solver
  const [solverState, setSolverState]   = useState<SolverState | null>(null);
  const [runwaysVisible, setRunwaysVisible] = useState(false);

  // Naive solver
  const [naiveResult, setNaiveResult]   = useState<NaiveResult | null>(null);

  // Mode: which algorithm is active
  const [appMode, setAppMode]           = useState<AppMode>('hungarian');

  // Compare-both sequence
  const [comparePhase, setComparePhase] = useState<ComparePhase>('idle');
  const [compareBanner, setCompareBanner] = useState<string | null>(null);
  const [showFuelSaved, setShowFuelSaved] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────

  const isComplete = solverState !== null &&
    solverState.currentStep === solverState.result.steps.length;

  const crashedAircraftIndices = naiveResult?.crashedAircraftIndices ?? [];
  const crashedAircraftIds = crashedAircraftIndices
    .map(i => scenario.aircraft[i]?.id ?? '')
    .filter(Boolean);

  const hasEmergency = appMode === 'naive' && crashedAircraftIds.length > 0 && runwaysVisible;

  // Naive radar assignments (shown after naive animation completes)
  const naiveRadarAssignments: Record<string, string> | null =
    naiveResult && runwaysVisible
      ? Object.fromEntries(
          naiveResult.assignmentPairs
            .filter(([row, col]) => row < scenario.aircraft.length && col < scenario.runways.length)
            .map(([row, col]) => [
              scenario.aircraft[row].id,
              scenario.runways[col].designation,
            ])
        )
      : null;

  // Hungarian radar assignments
  const hungarianRadarAssignments: Record<string, string> | null =
    isComplete && solverState && appMode === 'hungarian'
      ? Object.fromEntries(
          solverState.result.assignmentPairs
            .filter(([row, col]) => row < scenario.aircraft.length && col < scenario.runways.length)
            .map(([row, col]) => [
              scenario.aircraft[row].id,
              scenario.runways[col].designation,
            ])
        )
      : null;

  const radarAssignments = appMode === 'naive'
    ? naiveRadarAssignments
    : hungarianRadarAssignments;

  // Runway occupancy (sidebar badges, delayed)
  const runwayCallsign: Record<string, string | null> = Object.fromEntries(
    scenario.runways.map(r => [r.id, null])
  );
  if (runwaysVisible && appMode === 'hungarian' && solverState) {
    for (const [row, col] of solverState.result.assignmentPairs) {
      if (row < scenario.aircraft.length && col < scenario.runways.length) {
        runwayCallsign[scenario.runways[col].id] = scenario.aircraft[row].callsign;
      }
    }
  }
  if (runwaysVisible && appMode === 'naive' && naiveResult) {
    for (const [row, col] of naiveResult.assignmentPairs) {
      if (row < scenario.aircraft.length && col < scenario.runways.length) {
        runwayCallsign[scenario.runways[col].id] = scenario.aircraft[row].callsign;
      }
    }
  }

  // Step label for control bar
  const stepLabel = (() => {
    if (!solverState || appMode === 'naive') return null;
    if (solverState.currentStep === 0) return 'MATRIX INITIALIZED';
    const trace = solverState.result.steps[solverState.currentStep - 1];
    if (!trace) return null;
    const iter = trace.iterationIndex > 1 ? ` · ITER ${trace.iterationIndex}` : '';
    return `STEP ${trace.step} / 5 — ${trace.label.toUpperCase()}${iter}`;
  })();

  // Completed step numbers for checklist
  const completedNums = solverState && appMode === 'hungarian'
    ? new Set(
        solverState.result.steps
          .slice(0, solverState.currentStep)
          .map(s => s.step)
      )
    : new Set<number>();

  const currentStepNum = solverState && solverState.currentStep > 0 && appMode === 'hungarian'
    ? solverState.result.steps[solverState.currentStep - 1]?.step
    : null;

  // Footer metrics
  const hungarianCost = isComplete && appMode === 'hungarian'
    ? solverState!.result.totalCost
    : null;
  const naiveCost = naiveResult && runwaysVisible ? naiveResult.totalCost : null;
  const totalCost = appMode === 'naive' ? naiveCost : hungarianCost;

  const crashCount = hasEmergency ? crashedAircraftIds.length : 0;

  // Fuel saved metric — shown only in compare 'complete' phase
  const fuelSavedUnits = showFuelSaved && naiveResult
    ? (() => {
        const { matrix } = buildCostMatrix(scenario.aircraft, scenario.runways, scenario.weights);
        const hun = scenario.mode === 'max' ? solveMax(matrix) : solveMin(matrix);
        return naiveResult.totalCost - hun.totalCost;
      })()
    : null;

  const delayMin = naiveCost !== null && hungarianCost !== null
    ? Math.round((naiveCost - hungarianCost) * 0.3)
    : null;

  // ── Auto-play Hungarian ──────────────────────────────────────────────────

  useEffect(() => {
    if (!solverState?.isAutoPlaying || appMode === 'naive') return;
    const delay = solverState.currentStep === 0 ? 1500 : 2000;
    const timer = setTimeout(() => {
      setSolverState(s => {
        if (!s?.isAutoPlaying) return s;
        const next = s.currentStep + 1;
        return { ...s, currentStep: next, isAutoPlaying: next < s.result.steps.length };
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [solverState?.currentStep, solverState?.isAutoPlaying, appMode]);

  // ── Runway flip: 800ms after step 5 ────────────────────────────────────

  useEffect(() => {
    if (appMode !== 'hungarian') return;
    if (!isComplete) { setRunwaysVisible(false); return; }
    const t = setTimeout(() => setRunwaysVisible(true), 800);
    return () => clearTimeout(t);
  }, [isComplete, appMode]);

  // ── Compare-both state machine ──────────────────────────────────────────

  // Phase p1-naive: run naive algorithm
  useEffect(() => {
    if (comparePhase !== 'p1-naive') return;
    const naive = solveNaive(scenario.aircraft, scenario.runways, scenario.weights);
    setNaiveResult(naive);
    // Show vectors after pick animation
    const t1 = setTimeout(() => setRunwaysVisible(true), 2200);
    // Pause 3s then move to next phase
    const t2 = setTimeout(() => setComparePhase('p1-done'), 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [comparePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase p1-done: reset and transition to Hungarian
  useEffect(() => {
    if (comparePhase !== 'p1-done') return;
    setNaiveResult(null);
    setRunwaysVisible(false);
    setCompareBanner('Now running: HUNGARIAN OPTIMAL');
    setAppMode('hungarian');
    const t = setTimeout(() => setComparePhase('p2-hungarian'), 600);
    return () => clearTimeout(t);
  }, [comparePhase]);

  // Phase p2-hungarian: run Hungarian solver
  useEffect(() => {
    if (comparePhase !== 'p2-hungarian') return;
    const { matrix } = buildCostMatrix(scenario.aircraft, scenario.runways, scenario.weights);
    const result = scenario.mode === 'max' ? solveMax(matrix) : solveMin(matrix);
    setSolverState({ result, currentStep: 0, isAutoPlaying: true });
  }, [comparePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase p2-hungarian: when Hungarian completes, show fuel saved
  useEffect(() => {
    if (comparePhase !== 'p2-hungarian') return;
    if (!isComplete) return;
    const t = setTimeout(() => {
      setComparePhase('complete');
      setShowFuelSaved(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [comparePhase, isComplete]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const runSolver = useCallback((autoPlay: boolean) => {
    const { matrix } = buildCostMatrix(scenario.aircraft, scenario.runways, scenario.weights);
    const result = scenario.mode === 'max' ? solveMax(matrix) : solveMin(matrix);
    setSolverState({ result, currentStep: 0, isAutoPlaying: autoPlay });
    setNaiveResult(null);
    setRunwaysVisible(false);
    setShowFuelSaved(false);
    setComparePhase('idle');
    setCompareBanner(null);
  }, [scenario]);

  const runNaive = useCallback(() => {
    const naive = solveNaive(scenario.aircraft, scenario.runways, scenario.weights);
    setNaiveResult(naive);
    setSolverState(null);
    setRunwaysVisible(false);
    setShowFuelSaved(false);
    setComparePhase('idle');
    setCompareBanner(null);
    // Show assignment vectors after pick animation completes
    setTimeout(() => setRunwaysVisible(true), 1800);
  }, [scenario]);

  const handleStep = useCallback(() => {
    if (appMode === 'naive') { runNaive(); return; }
    if (!solverState) { runSolver(false); return; }
    if (isComplete) return;
    setSolverState(s => s ? { ...s, currentStep: s.currentStep + 1, isAutoPlaying: false } : s);
  }, [solverState, isComplete, runSolver, runNaive, appMode]);

  const handleRun = useCallback(() => {
    if (appMode === 'naive') { runNaive(); return; }
    runSolver(true);
  }, [appMode, runNaive, runSolver]);

  const startCompare = useCallback(() => {
    // Reset all state
    setSolverState(null);
    setNaiveResult(null);
    setRunwaysVisible(false);
    setShowFuelSaved(false);
    setCompareBanner('DEMO: NAIVE FCFS vs HUNGARIAN OPTIMAL — same scenario, same costs');
    setAppMode('naive');
    setComparePhase('p1-naive');
  }, []);

  const switchMode = useCallback((mode: AppMode) => {
    setAppMode(mode);
    setSolverState(null);
    setNaiveResult(null);
    setRunwaysVisible(false);
    setShowFuelSaved(false);
    setComparePhase('idle');
    setCompareBanner(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="h-screen overflow-hidden grid grid-rows-[44px_auto_1fr_38px]"
      style={hasEmergency ? { animation: 'emergencyVignette 1.5s ease-in-out infinite' } : undefined}
    >

      {/* ── Row 1: Top status bar ─────────────────────────────────────────── */}
      <header className="border-b border-atc-border bg-atc-panel/90 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6 text-[9px] uppercase tracking-[0.25em]">
          <span className="text-atc-scope glow-scope font-bold text-[11px] tracking-[0.35em]">
            ◉ SKYASSIGN
          </span>
          <span className="text-atc-border">|</span>
          <span className="text-atc-mute">ATC Runway Assignment Simulator</span>
          <span className="text-atc-border">|</span>
          <span className="text-atc-mute">KBLR · VOBL · APP 119.1</span>
        </div>
        <div className="flex items-center gap-5 text-[9px] uppercase tracking-[0.22em]">
          <span className="text-atc-scope-dim">{scenario.aircraft.length} ACFT</span>
          <span className="text-atc-border">·</span>
          <span className="text-atc-scope-dim">{scenario.runways.length} RWY</span>
          <span className="text-atc-border">·</span>
          {hasEmergency ? (
            <span className="text-atc-warn font-bold"
              style={{ animation: 'emergencyBlink 0.6s step-end infinite',
                       textShadow: '0 0 8px var(--color-atc-warn)' }}>
              ⚠ EMERGENCY
            </span>
          ) : (
            <span className="text-atc-amber glow-amber">SYS NOMINAL</span>
          )}
          <span className="text-atc-border">|</span>
          <SystemClock />
        </div>
      </header>

      {/* ── Row 2: Scenario + mode bar ────────────────────────────────────── */}
      <div className="border-b border-atc-border bg-atc-void/70 px-5 flex flex-col shrink-0">

        {/* Compare banner (shown during compare sequence) */}
        {compareBanner && (
          <div className="border-b border-atc-amber/30 bg-atc-amber/5 px-0 py-[3px] text-[7.5px] uppercase tracking-[0.28em] text-atc-amber text-center">
            {compareBanner}
          </div>
        )}

        {/* Naive mode warning strip */}
        {appMode === 'naive' && !compareBanner && (
          <div className="border-b border-atc-amber/20 bg-atc-amber/4 px-0 py-[3px] text-[7px] uppercase tracking-[0.28em] text-atc-amber/70 text-center">
            MODE: NAIVE FCFS — FIRST COME FIRST SERVED — NOT OPTIMAL
          </div>
        )}

        <div className="flex items-center gap-4 py-1.5 text-[8.5px] uppercase tracking-[0.25em]">
          <span className="text-atc-mute">SCN</span>
          <span className="text-atc-hud font-semibold">{scenario.name}</span>
          <span className="text-atc-border">·</span>
          <span className="text-atc-mute">{scenario.description}</span>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-atc-mute">MODE</span>

            {/* Hungarian OPT button */}
            <button
              onClick={() => switchMode('hungarian')}
              className={`border px-2.5 py-[2px] text-[8px] tracking-[0.3em] transition-colors cursor-pointer ${
                appMode === 'hungarian'
                  ? 'border-atc-scope/70 text-atc-scope'
                  : 'border-atc-border/40 text-atc-mute/40 hover:border-atc-border hover:text-atc-mute'
              }`}
            >
              HUNGARIAN OPT
            </button>

            {/* Naive FCFS button */}
            <button
              onClick={() => switchMode('naive')}
              className={`border px-2.5 py-[2px] text-[8px] tracking-[0.3em] transition-colors cursor-pointer ${
                appMode === 'naive'
                  ? 'border-atc-amber/70 text-atc-amber'
                  : 'border-atc-border/40 text-atc-mute/40 hover:border-atc-border hover:text-atc-mute'
              }`}
            >
              NAIVE FCFS
            </button>

            <span className="text-atc-border">|</span>

            <RunControls
              onRun={handleRun}
              onStep={handleStep}
              stepLabel={stepLabel}
              isAutoPlaying={solverState?.isAutoPlaying ?? false}
              isComplete={isComplete && appMode === 'hungarian'}
            />

            {/* Compare Both button */}
            <button
              onClick={startCompare}
              className="border border-atc-cyan/50 text-atc-cyan/80 px-2.5 py-[2px] text-[8px] tracking-[0.25em] hover:border-atc-cyan hover:text-atc-cyan transition-colors cursor-pointer"
            >
              ⇄ COMPARE BOTH
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 3: Main workspace ────────────────────────────────────────── */}
      <section className="min-h-0 overflow-hidden grid grid-cols-[1fr_380px] gap-px bg-atc-border">

        {/* Left — radar scope */}
        <div className="bg-atc-void min-h-0 overflow-hidden flex items-center justify-center p-1">
          <AnimatedRadarScope
            aircraft={scenario.aircraft}
            runways={scenario.runways}
            assignments={radarAssignments}
            crashedAircraftIds={hasEmergency ? crashedAircraftIds : []}
          />
        </div>

        {/* Right — data panel */}
        <aside className="bg-atc-panel min-h-0 overflow-y-auto flex flex-col">

          {/* Traffic roster */}
          <div className="shrink-0 border-b border-atc-border px-4 pt-3 pb-2.5">
            <div className="text-[8px] uppercase tracking-[0.35em] text-atc-amber mb-2">
              Traffic · {scenario.aircraft.length} inbound
            </div>
            <div className="space-y-[5px]">
              {scenario.aircraft.map(ac => {
                const isWarn    = ac.fuelPercent <= 25;
                const isCrit    = ac.fuelPercent <= 10;
                const isCrashed = hasEmergency && crashedAircraftIds.includes(ac.id);
                const fuelColor = isCrashed ? 'text-atc-warn' : isCrit ? 'text-atc-warn' : isWarn ? 'text-atc-amber' : 'text-atc-hud';
                const barColor  = isCrashed ? 'bg-atc-warn'  : isCrit ? 'bg-atc-warn'  : isWarn ? 'bg-atc-amber'  : 'bg-atc-scope';
                const assignedTo = runwaysVisible ? radarAssignments?.[ac.id] : undefined;
                return (
                  <div key={ac.id} className="flex items-center gap-2 text-[8.5px] font-mono">
                    <span className={`w-[68px] font-semibold tracking-wide ${fuelColor}`}>
                      {ac.callsign}
                    </span>
                    <span className="text-atc-mute w-8">{ac.category.slice(0, 3)}</span>
                    <span className="text-atc-cyan w-10">
                      FL{String(Math.round(ac.altitude / 100)).padStart(3, '0')}
                    </span>
                    <div className="flex-1 flex items-center gap-1.5">
                      <div className="flex-1 h-[3px] bg-atc-border/60 relative">
                        <div className={`h-full ${barColor}`} style={{ width: `${ac.fuelPercent}%`, opacity: 0.85 }} />
                      </div>
                      <span className={`w-7 text-right text-[8px] ${fuelColor}`}>{ac.fuelPercent}%</span>
                    </div>
                    {isCrashed && (
                      <span className="text-atc-warn text-[7px] tracking-wider font-bold"
                        style={{ animation: 'emergencyBlink 0.6s step-end infinite' }}>
                        ✗
                      </span>
                    )}
                    {!isCrashed && isCrit && <span className="text-atc-warn text-[7px] tracking-wider">⚠</span>}
                    {assignedTo && !isCrashed && (
                      <span className={`text-[7px] tracking-wider font-bold ${
                        appMode === 'naive' ? 'text-atc-amber' : 'text-atc-scope'
                      }`}>→{assignedTo}</span>
                    )}
                    {assignedTo && isCrashed && (
                      <span className="text-atc-warn text-[7px] tracking-wider font-bold">✗{assignedTo}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cost matrix panel */}
          <div className="shrink-0 border-b border-atc-border px-4 pt-3 pb-3">
            <div className="text-[8px] uppercase tracking-[0.35em] mb-1.5"
              style={{ color: appMode === 'naive' ? 'var(--color-atc-amber)' : 'var(--color-atc-amber)' }}>
              {appMode === 'naive' ? 'Cost Matrix · Naive FCFS' : 'Cost Matrix · Hungarian'}
            </div>
            <div className="text-[7.5px] text-atc-mute font-mono mb-3 leading-relaxed opacity-80">
              C[i][j] = 0.4·fuel + 0.3·dist + 0.2·compat + 0.1·gate
            </div>
            <MatrixPanel
              aircraft={scenario.aircraft}
              runways={scenario.runways}
              result={appMode === 'hungarian' ? (solverState?.result ?? null) : null}
              currentStep={appMode === 'hungarian' ? (solverState?.currentStep ?? -1) : -1}
              naiveMode={appMode === 'naive'}
              naiveResult={appMode === 'naive' ? naiveResult : null}
            />
          </div>

          {/* Algorithm step list */}
          <div className="shrink-0 border-b border-atc-border px-4 pt-3 pb-3">
            <div className="text-[8px] uppercase tracking-[0.35em] text-atc-amber mb-2">
              Algorithm Steps
            </div>

            {appMode === 'naive' ? (
              /* Naive: single greedy step */
              <div className="space-y-[3px]">
                <div className="flex items-center gap-2 text-[7.5px] font-mono py-[2px]">
                  <span className="w-4 text-right text-atc-amber opacity-70">1</span>
                  <div className="w-[5px] h-[5px] shrink-0"
                    style={{ background: naiveResult ? 'var(--color-atc-amber)' : 'transparent',
                             border: naiveResult ? 'none' : '1px solid #1f3358' }} />
                  <span className={`uppercase tracking-wide ${naiveResult ? 'text-atc-amber' : 'text-atc-mute opacity-50'}`}>
                    Greedy: closest-first
                  </span>
                  {naiveResult && (
                    <span className="ml-auto text-[6.5px] text-atc-amber-dim tracking-widest">✓</span>
                  )}
                </div>
                <div className="mt-2 text-[7px] font-mono text-atc-mute opacity-60 leading-relaxed">
                  No row reduction · no line covers<br/>
                  Greedy local choice — not globally optimal
                </div>
              </div>
            ) : (
              /* Hungarian: 5-step checklist */
              <div className="space-y-[3px]">
                {STEP_NAMES.map((name, i) => {
                  const num       = i + 1;
                  const done      = completedNums.has(num);
                  const active    = currentStepNum === num;
                  const textColor = done || active ? 'text-atc-scope' : 'text-atc-mute opacity-50';
                  const boxStyle  = done
                    ? { background: 'var(--color-atc-scope)', animation: 'stepCheck 0.3s ease-out' }
                    : active
                      ? { border: '1px solid var(--color-atc-scope)', background: 'rgba(0,255,156,0.15)' }
                      : { border: '1px solid #1f3358' };
                  return (
                    <div key={i} className="flex items-center gap-2 text-[7.5px] font-mono py-[2px]">
                      <span className={`w-4 text-right ${done || active ? 'text-atc-scope' : 'text-atc-border opacity-70'}`}>
                        {num}
                      </span>
                      <div className="w-[5px] h-[5px] shrink-0" style={boxStyle} />
                      <span className={`uppercase tracking-wide ${textColor}`}>{name}</span>
                      {active && !done && (
                        <span className="ml-auto text-[6.5px] text-atc-scope tracking-widest">▶ ACTIVE</span>
                      )}
                      {done && (
                        <span className="ml-auto text-[6.5px] text-atc-scope-dim tracking-widest">✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Runway status */}
          <div className="shrink-0 px-4 pt-3 pb-3">
            <div className="text-[8px] uppercase tracking-[0.3em] text-atc-amber mb-2">Runway Status</div>
            <div className="grid grid-cols-4 gap-2">
              {scenario.runways.map(rwy => {
                const callsign = runwayCallsign[rwy.id];
                const isCrashedRwy = hasEmergency && callsign &&
                  crashedAircraftIds.some(id =>
                    scenario.aircraft.find(a => a.id === id)?.callsign === callsign
                  );
                return (
                  <div key={rwy.id}
                    className={`border px-2 py-1.5 text-center transition-colors duration-500 ${
                      isCrashedRwy
                        ? 'border-atc-warn/80'
                        : callsign ? 'border-atc-warn/60' : 'border-atc-border/60'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold text-atc-hud tracking-widest">
                      {rwy.designation}
                    </div>
                    <div className={`w-full h-[2px] mt-1 transition-colors duration-500 opacity-70 ${
                      isCrashedRwy ? 'bg-atc-warn' : callsign ? 'bg-atc-warn' : 'bg-atc-scope'
                    }`} />
                    {callsign ? (
                      <>
                        <div className={`text-[6.5px] mt-1 uppercase tracking-wider ${
                          isCrashedRwy ? 'text-atc-warn' : 'text-atc-warn'
                        }`}>
                          {isCrashedRwy ? 'CRASH' : 'OCCUP'}
                        </div>
                        <div className={`text-[6.5px] font-mono font-bold leading-tight ${
                          isCrashedRwy ? 'text-atc-warn' : 'text-atc-warn'
                        }`}>{callsign}</div>
                      </>
                    ) : (
                      <div className="text-[7px] text-atc-scope-dim mt-1 uppercase tracking-wider">AVAIL</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>

      {/* ── Row 4: Bottom metrics / footer ────────────────────────────────── */}
      <footer className="border-t border-atc-border bg-atc-panel/90 px-5 flex items-center gap-0 shrink-0">
        {/* TOTAL COST */}
        <div className="flex items-center gap-3 pr-6 mr-6 border-r border-atc-border">
          <span className="text-[7.5px] uppercase tracking-[0.25em] text-atc-mute">TOTAL COST</span>
          <span className={`text-[13px] font-mono font-semibold tabular-nums ${
            totalCost !== null
              ? appMode === 'naive' ? 'text-atc-amber' : 'text-atc-scope glow-scope'
              : 'text-atc-hud'
          }`}>
            {totalCost !== null ? String(totalCost) : '—'}
          </span>
        </div>

        {/* CRASHES */}
        <div className="flex items-center gap-3 pr-6 mr-6 border-r border-atc-border">
          <span className="text-[7.5px] uppercase tracking-[0.25em] text-atc-mute">CRASHES</span>
          <span className={`text-[13px] font-mono font-semibold tabular-nums text-atc-warn ${
            crashCount > 0 ? 'glow-warn' : ''
          }`}
            style={crashCount > 0 ? { animation: 'emergencyBlink 0.8s step-end infinite' } : undefined}>
            {crashCount}
          </span>
        </div>

        {/* HOLDING */}
        <div className="flex items-center gap-3 pr-6 mr-6 border-r border-atc-border">
          <span className="text-[7.5px] uppercase tracking-[0.25em] text-atc-mute">HOLDING</span>
          <span className="text-[13px] font-mono font-semibold tabular-nums text-atc-amber">0</span>
        </div>

        {/* FUEL SAVED */}
        <div className="flex items-center gap-3 pr-6 mr-6 border-r border-atc-border">
          <span className="text-[7.5px] uppercase tracking-[0.25em] text-atc-mute">FUEL SAVED</span>
          {showFuelSaved && fuelSavedUnits !== null ? (
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-semibold tabular-nums text-atc-scope glow-scope">
                {fuelSavedUnits}u
              </span>
              <span className="text-[9px] font-mono font-bold text-atc-scope life-saved-glow uppercase tracking-wider">
                · 1 LIFE SAVED
              </span>
            </span>
          ) : (
            <span className="text-[13px] font-mono font-semibold tabular-nums text-atc-hud">—</span>
          )}
        </div>

        {/* DELAY MIN */}
        <div className="flex items-center gap-3 pr-6 mr-6 border-r border-atc-border last:border-0">
          <span className="text-[7.5px] uppercase tracking-[0.25em] text-atc-mute">DELAY MIN</span>
          <span className="text-[13px] font-mono font-semibold tabular-nums text-atc-cyan">
            {appMode === 'naive' && naiveCost !== null
              ? `+${Math.round(naiveCost * 0.3)}`
              : '0'}
          </span>
        </div>

        <div className="ml-auto text-[7.5px] uppercase tracking-[0.2em] text-atc-mute">
          OR · Unit IV · Assignment Problem · JSS STU Mysore
        </div>
      </footer>
    </main>
  );
}

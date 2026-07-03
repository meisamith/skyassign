'use client';

interface Props {
  onRun:         () => void;
  onStep:        () => void;
  stepLabel:     string | null;
  isAutoPlaying: boolean;
  isComplete:    boolean;
}

export default function RunControls({ onRun, onStep, stepLabel, isAutoPlaying, isComplete }: Props) {
  const runDisabled  = isAutoPlaying;
  const stepDisabled = isAutoPlaying || isComplete;

  return (
    <div className="flex items-center gap-2">
      {/* Step status label */}
      {stepLabel && (
        <span className="text-[7.5px] font-mono text-atc-cyan tracking-wider opacity-85 mr-1 max-w-[180px] truncate">
          {stepLabel}
        </span>
      )}

      <button
        onClick={onRun}
        disabled={runDisabled}
        className={[
          'border border-atc-scope text-atc-scope',
          'px-3 py-[3px] text-[8px] uppercase tracking-[0.3em] font-mono',
          'transition-all duration-150',
          runDisabled
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:[box-shadow:0_0_8px_2px_var(--color-atc-scope)] hover:[text-shadow:0_0_6px_var(--color-atc-scope)]',
        ].join(' ')}
      >
        ▶ RUN HUNGARIAN
      </button>

      <button
        onClick={onStep}
        disabled={stepDisabled}
        className={[
          'border border-atc-amber text-atc-amber',
          'px-3 py-[3px] text-[8px] uppercase tracking-[0.3em] font-mono',
          'transition-all duration-150',
          stepDisabled
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:[box-shadow:0_0_8px_2px_var(--color-atc-amber)] hover:[text-shadow:0_0_6px_var(--color-atc-amber)]',
        ].join(' ')}
      >
        ⏭ STEP
      </button>
    </div>
  );
}

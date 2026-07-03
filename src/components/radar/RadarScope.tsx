'use client';

import { useEffect, useRef } from 'react';
import type { Aircraft, Runway } from '@/simulation/types';
import AircraftBlip from './AircraftBlip';
import HoldingPattern from './HoldingPattern';

// ─── Coordinate system ────────────────────────────────────────────────────────
// 1000×1000 viewBox — square — scales perfectly inside any aspect ratio container
export const CX = 500;
export const CY = 500;
export const R  = 455;          // scope radius in viewBox units
export const RANGE_NM = 50;
export const NM_PX = R / RANGE_NM;   // 9.1 px / NM

export function polarToSVG(bearingDeg: number, distNM: number): [number, number] {
  const r = Math.min(distNM, RANGE_NM - 0.5) * NM_PX; // clamp to inside scope
  const rad = (bearingDeg * Math.PI) / 180;
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
}

// ─── Static layout constants ──────────────────────────────────────────────────

const RANGE_RINGS = [10, 20, 30, 40, 50].map(nm => ({
  nm,
  r: nm * NM_PX,
}));

// Bearing ticks every 10°; major every 30°
const BEARING_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

// Cardinal labels
const CARDINALS = [
  { deg: 0,   label: '000', ox:  0, oy: -1 },
  { deg: 90,  label: '090', ox:  1, oy:  0 },
  { deg: 180, label: '180', ox:  0, oy:  1 },
  { deg: 270, label: '270', ox: -1, oy:  0 },
];

// KBLR airport — 4-runway schematic at centre.
// Two parallel E-W strips (09L/27R and 09R/27L).
// Each strip 80 px long × 6 px wide.  Total footprint ≈ 7% of scope diameter.
// Drawn ABOVE the VOR symbol so KBLR label sits clear below.
const RWY_LEN = 80;
const RWY_W   = 6;
const RWY_HALF = RWY_LEN / 2;
// North strip (09R threshold west, 27L east)
const RWY_N_Y = CY - 12;
// South strip (09L threshold west, 27R east)
const RWY_S_Y = CY + 2;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  aircraft: Aircraft[];
  runways: Runway[];
  /** When true, PAPI lights are omitted (AnimatedRadarScope renders them with blink) */
  hidePapi?: boolean;
  /** When true, aircraft blips + holding patterns are omitted (AnimatedRadarScope renders them) */
  hideAircraft?: boolean;
}

export default function RadarScope({ aircraft, hidePapi = false, hideAircraft = false }: Props) {
  const sweepRef = useRef<SVGGElement>(null);

  // rAF sweep — rotates a <g> around the scope centre using setAttribute
  // (avoids CSS transform-origin issues with scaled SVG viewBoxes)
  useEffect(() => {
    let raf: number;
    let t0: number | null = null;
    const PERIOD = 4000; // ms per rotation

    function tick(ts: number) {
      if (t0 === null) t0 = ts;
      const angle = ((ts - t0) % PERIOD) / PERIOD * 360;
      sweepRef.current?.setAttribute('transform', `rotate(${angle},${CX},${CY})`);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <filter id="gls" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glw" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glr" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id="sc">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        {/* Hex tile pattern for scope background texture */}
        <pattern id="hx" x="0" y="0" width="32" height="28" patternUnits="userSpaceOnUse">
          <path d="M16,2 L26,8 L26,20 L16,26 L6,20 L6,8 Z"
            fill="none" stroke="var(--color-atc-grid)" strokeWidth={0.5} opacity={0.55} />
        </pattern>
      </defs>

      {/* ── Scope disc ───────────────────────────────────────────────────────── */}
      <circle cx={CX} cy={CY} r={R} fill="var(--color-atc-deep)" />
      <circle cx={CX} cy={CY} r={R} fill="url(#hx)" opacity={0.45} />

      {/* ── Clipped scope interior ───────────────────────────────────────────── */}
      <g clipPath="url(#sc)">

        {/* Range rings */}
        {RANGE_RINGS.map(({ nm, r }) => (
          <circle key={nm} cx={CX} cy={CY} r={r}
            fill="none"
            stroke="var(--color-atc-grid)"
            strokeWidth={nm === 50 ? 0.9 : 0.55}
            opacity={nm === 50 ? 0.55 : 0.3}
          />
        ))}

        {/* Cross-hairs (N-S, E-W) */}
        <line x1={CX} y1={CY-R} x2={CX} y2={CY+R}
          stroke="var(--color-atc-grid)" strokeWidth={0.4} opacity={0.28} />
        <line x1={CX-R} y1={CY} x2={CX+R} y2={CY}
          stroke="var(--color-atc-grid)" strokeWidth={0.4} opacity={0.28} />

        {/* Bearing ticks on outer ring */}
        {BEARING_TICKS.map(deg => {
          const rad = (deg * Math.PI) / 180;
          const major = deg % 30 === 0;
          const outer = R;
          const inner = major ? R - 14 : R - 7;
          return (
            <line key={deg}
              x1={CX + outer * Math.sin(rad)} y1={CY - outer * Math.cos(rad)}
              x2={CX + inner * Math.sin(rad)} y2={CY - inner * Math.cos(rad)}
              stroke="var(--color-atc-scope-dim)"
              strokeWidth={major ? 1.2 : 0.5}
              opacity={major ? 0.7 : 0.4}
            />
          );
        })}

        {/* Range labels inside rings, at 075° bearing */}
        {RANGE_RINGS.map(({ nm, r }) => {
          const rad = 75 * Math.PI / 180;
          return (
            <text key={nm}
              x={CX + r * Math.sin(rad) + 3}
              y={CY - r * Math.cos(rad) + 3}
              fill="var(--color-atc-scope-dim)" fontSize={9}
              fontFamily="var(--font-mono)" opacity={0.6}
            >
              {nm}
            </text>
          );
        })}

        {/* ── Radar sweep ─────────────────────────────────────────────────────── */}
        <g ref={sweepRef}>
          {/* Phosphor afterglow — 3 arcs at decreasing opacity behind the blade */}
          {([45, 65, 85] as const).map((arcDeg, i) => {
            const opc = [0.09, 0.055, 0.025][i];
            const a0rad = (-arcDeg * Math.PI) / 180;
            const x0 = CX + R * Math.sin(a0rad);
            const y0 = CY - R * Math.cos(a0rad);
            // Blade is at angle 0 (pointing north in local space before rotate)
            return (
              <path key={arcDeg}
                d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${CX} ${CY - R} Z`}
                fill="var(--color-atc-scope)"
                opacity={opc}
              />
            );
          })}
          {/* Blade — bright thin line */}
          <line x1={CX} y1={CY} x2={CX} y2={CY - R}
            stroke="var(--color-atc-scope)"
            strokeWidth={2}
            opacity={0.9}
            filter="url(#gls)"
          />
        </g>

        {/* ── Airport centre — KBLR runway diagram ────────────────────────── */}
        <g>
          {/* Faint airport boundary box so the centre reads as a distinct feature */}
          <rect
            x={CX - RWY_HALF - 16} y={RWY_N_Y - 10}
            width={RWY_LEN + 32} height={RWY_S_Y + RWY_W + 10 - (RWY_N_Y - 10)}
            fill="rgba(30,45,60,0.35)" stroke="var(--color-atc-grid)"
            strokeWidth={0.5} rx={2} opacity={0.7}
          />

          {/* ── North runway strip: 09R (W threshold) / 27L (E threshold) ── */}
          <rect
            x={CX - RWY_HALF} y={RWY_N_Y}
            width={RWY_LEN} height={RWY_W}
            fill="#243040" stroke="#4a6080" strokeWidth={0.7}
          />
          {/* Centerline dashes */}
          {Array.from({ length: 6 }, (_, d) => (
            <line key={d}
              x1={CX - RWY_HALF + 5 + d * 12} y1={RWY_N_Y + RWY_W / 2}
              x2={CX - RWY_HALF + 10 + d * 12} y2={RWY_N_Y + RWY_W / 2}
              stroke="#6a8aaa" strokeWidth={0.6} opacity={0.5}
            />
          ))}
          {/* Threshold stripes west */}
          {[0,1,2].map(s => (
            <rect key={s}
              x={CX - RWY_HALF + s * 4} y={RWY_N_Y + 1}
              width={2.5} height={RWY_W - 2}
              fill="#8aaccc" opacity={0.55}
            />
          ))}
          {/* Threshold stripes east */}
          {[0,1,2].map(s => (
            <rect key={s}
              x={CX + RWY_HALF - 3 - s * 4} y={RWY_N_Y + 1}
              width={2.5} height={RWY_W - 2}
              fill="#8aaccc" opacity={0.55}
            />
          ))}
          {/* PAPI lights — west end (09R side) — hidden when AnimatedRadarScope owns them */}
          {!hidePapi && [0,1,2,3].map(p => (
            <circle key={`nw${p}`}
              cx={CX - RWY_HALF + 3 + p * 5} cy={RWY_N_Y - 4}
              r={2} fill="var(--color-atc-scope)" opacity={0.8}
              filter="url(#gls)"
            />
          ))}
          {/* PAPI lights — east end (27L side) */}
          {!hidePapi && [0,1,2,3].map(p => (
            <circle key={`ne${p}`}
              cx={CX + RWY_HALF - 3 - p * 5} cy={RWY_N_Y - 4}
              r={2} fill="var(--color-atc-scope)" opacity={0.8}
              filter="url(#gls)"
            />
          ))}
          {/* Threshold labels */}
          <text x={CX - RWY_HALF - 4} y={RWY_N_Y + RWY_W / 2 + 3}
            textAnchor="end" fill="var(--color-atc-hud)"
            fontSize={8} fontFamily="var(--font-mono)" fontWeight={700} opacity={0.85}>
            09R
          </text>
          <text x={CX + RWY_HALF + 4} y={RWY_N_Y + RWY_W / 2 + 3}
            textAnchor="start" fill="var(--color-atc-hud)"
            fontSize={8} fontFamily="var(--font-mono)" fontWeight={700} opacity={0.85}>
            27L
          </text>

          {/* ── South runway strip: 09L (W threshold) / 27R (E threshold) ── */}
          <rect
            x={CX - RWY_HALF} y={RWY_S_Y}
            width={RWY_LEN} height={RWY_W}
            fill="#243040" stroke="#4a6080" strokeWidth={0.7}
          />
          {/* Centerline dashes */}
          {Array.from({ length: 6 }, (_, d) => (
            <line key={d}
              x1={CX - RWY_HALF + 5 + d * 12} y1={RWY_S_Y + RWY_W / 2}
              x2={CX - RWY_HALF + 10 + d * 12} y2={RWY_S_Y + RWY_W / 2}
              stroke="#6a8aaa" strokeWidth={0.6} opacity={0.5}
            />
          ))}
          {/* Threshold stripes west */}
          {[0,1,2].map(s => (
            <rect key={s}
              x={CX - RWY_HALF + s * 4} y={RWY_S_Y + 1}
              width={2.5} height={RWY_W - 2}
              fill="#8aaccc" opacity={0.55}
            />
          ))}
          {/* Threshold stripes east */}
          {[0,1,2].map(s => (
            <rect key={s}
              x={CX + RWY_HALF - 3 - s * 4} y={RWY_S_Y + 1}
              width={2.5} height={RWY_W - 2}
              fill="#8aaccc" opacity={0.55}
            />
          ))}
          {/* PAPI lights — west (09L) — hidden when AnimatedRadarScope owns them */}
          {!hidePapi && [0,1,2,3].map(p => (
            <circle key={`sw${p}`}
              cx={CX - RWY_HALF + 3 + p * 5} cy={RWY_S_Y + RWY_W + 4}
              r={2} fill="var(--color-atc-scope)" opacity={0.8}
              filter="url(#gls)"
            />
          ))}
          {/* PAPI lights — east (27R) */}
          {!hidePapi && [0,1,2,3].map(p => (
            <circle key={`se${p}`}
              cx={CX + RWY_HALF - 3 - p * 5} cy={RWY_S_Y + RWY_W + 4}
              r={2} fill="var(--color-atc-scope)" opacity={0.8}
              filter="url(#gls)"
            />
          ))}
          {/* Threshold labels */}
          <text x={CX - RWY_HALF - 4} y={RWY_S_Y + RWY_W / 2 + 3}
            textAnchor="end" fill="var(--color-atc-hud)"
            fontSize={8} fontFamily="var(--font-mono)" fontWeight={700} opacity={0.85}>
            09L
          </text>
          <text x={CX + RWY_HALF + 4} y={RWY_S_Y + RWY_W / 2 + 3}
            textAnchor="start" fill="var(--color-atc-hud)"
            fontSize={8} fontFamily="var(--font-mono)" fontWeight={700} opacity={0.85}>
            27R
          </text>

          {/* Central taxiway spine between the two strips */}
          <line x1={CX} y1={RWY_N_Y + RWY_W} x2={CX} y2={RWY_S_Y}
            stroke="#4a6080" strokeWidth={1} opacity={0.4} />

          {/* VOR / airport reference point — sits below the runways */}
          <circle cx={CX} cy={RWY_S_Y + RWY_W + 14}
            r={3} fill="none" stroke="var(--color-atc-hud)"
            strokeWidth={1} opacity={0.6} />
          <line x1={CX - 7} y1={RWY_S_Y + RWY_W + 14}
            x2={CX + 7} y2={RWY_S_Y + RWY_W + 14}
            stroke="var(--color-atc-hud)" strokeWidth={0.8} opacity={0.5} />
          <line x1={CX} y1={RWY_S_Y + RWY_W + 7}
            x2={CX} y2={RWY_S_Y + RWY_W + 21}
            stroke="var(--color-atc-hud)" strokeWidth={0.8} opacity={0.5} />

          {/* KBLR / VOBL labels below the VOR */}
          <text x={CX} y={RWY_S_Y + RWY_W + 33}
            textAnchor="middle" fill="var(--color-atc-hud)"
            fontSize={10} fontFamily="var(--font-mono)" fontWeight={700}
            opacity={0.9} letterSpacing={2}>
            KBLR
          </text>
          <text x={CX} y={RWY_S_Y + RWY_W + 44}
            textAnchor="middle" fill="var(--color-atc-mute)"
            fontSize={7} fontFamily="var(--font-mono)" opacity={0.6}>
            VOBL · 13°12′N 077°42′E
          </text>
        </g>

        {/* ── Holding patterns ──────────────────────────────────────────────── */}
        {!hideAircraft && aircraft.filter(ac => ac.isDummy).map(ac => {
          const [hx, hy] = polarToSVG(ac.positionAngleDeg, ac.distanceNM);
          return (
            <HoldingPattern key={ac.id} cx={hx} cy={hy} rx={36} ry={22}
              label={`HOLD FL${String(Math.round(ac.altitude/100)).padStart(3,'0')}`} />
          );
        })}

        {/* ── Aircraft blips ────────────────────────────────────────────────── */}
        {!hideAircraft && aircraft.map(ac => {
          const [ax, ay] = polarToSVG(ac.positionAngleDeg, ac.distanceNM);
          const etaSec = Math.round((ac.distanceNM / ac.speedKts) * 3600);
          return (
            <AircraftBlip key={ac.id}
              aircraft={ac}
              x={ax} y={ay}
              scopeCX={CX} scopeCY={CY} scopeR={R}
              etaSec={etaSec}
            />
          );
        })}

        {/* ── Scope corner overlays ─────────────────────────────────────────── */}

        {/* Top-left: instrument label */}
        <text x={CX - R + 18} y={CY - R + 22}
          fill="var(--color-atc-scope-dim)" fontSize={8.5}
          fontFamily="var(--font-mono)" letterSpacing={1} opacity={0.65}>
          PRI SUR · KBLR · RNG {RANGE_NM}NM · SWP 4s
        </text>

        {/* Top-left: North arrow */}
        <g transform={`translate(${CX - R + 28}, ${CY - R + 55})`}>
          <line x1={0} y1={22} x2={0} y2={2} stroke="var(--color-atc-scope-dim)" strokeWidth={1.2} opacity={0.7} />
          <polygon points="0,-2 -4,5 4,5" fill="var(--color-atc-scope-dim)" opacity={0.7} />
          <text x={0} y={33} textAnchor="middle"
            fill="var(--color-atc-scope-dim)" fontSize={9}
            fontFamily="var(--font-mono)" fontWeight={600} opacity={0.7}>
            N
          </text>
        </g>

        {/* Bottom-left: range scale bar (10 NM) */}
        <g transform={`translate(${CX - R + 18}, ${CY + R - 30})`}>
          <line x1={0} y1={0} x2={NM_PX * 10} y2={0}
            stroke="var(--color-atc-scope-dim)" strokeWidth={1.2} opacity={0.65} />
          <line x1={0} y1={-4} x2={0} y2={4}
            stroke="var(--color-atc-scope-dim)" strokeWidth={1} opacity={0.65} />
          <line x1={NM_PX * 10} y1={-4} x2={NM_PX * 10} y2={4}
            stroke="var(--color-atc-scope-dim)" strokeWidth={1} opacity={0.65} />
          <text x={NM_PX * 5} y={-7} textAnchor="middle"
            fill="var(--color-atc-scope-dim)" fontSize={8}
            fontFamily="var(--font-mono)" opacity={0.65}>
            10 NM
          </text>
        </g>

        {/* Bottom-right: range legend */}
        <text x={CX + R - 18} y={CY + R - 18}
          textAnchor="end"
          fill="var(--color-atc-mute)" fontSize={8}
          fontFamily="var(--font-mono)" opacity={0.55}>
          RANGE {RANGE_NM} NM
        </text>
      </g>

      {/* ── Scope rim (outside clip) ─────────────────────────────────────────── */}
      {/* Inner rim glow */}
      <circle cx={CX} cy={CY} r={R}
        fill="none" stroke="var(--color-atc-scope-dim)"
        strokeWidth={1.5} opacity={0.4} filter="url(#gls)" />
      {/* Hard border ring */}
      <circle cx={CX} cy={CY} r={R + 2}
        fill="none" stroke="var(--color-atc-border)"
        strokeWidth={4} opacity={0.9} />
      {/* Outer ambient glow */}
      <circle cx={CX} cy={CY} r={R + 3}
        fill="none" stroke="var(--color-atc-scope)"
        strokeWidth={1} opacity={0.06} filter="url(#gls)" />

      {/* ── Cardinal labels (just outside the rim) ──────────────────────────── */}
      {CARDINALS.map(({ label, ox, oy }) => (
        <text key={label}
          x={CX + ox * (R + 22)}
          y={CY + oy * (R + 22) + 4}
          textAnchor="middle"
          fill="var(--color-atc-scope-dim)"
          fontSize={9.5} fontFamily="var(--font-mono)"
          letterSpacing={2} opacity={0.65}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

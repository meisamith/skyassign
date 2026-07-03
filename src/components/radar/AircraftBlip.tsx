'use client';

import { motion } from 'framer-motion';
import type { Aircraft } from '@/simulation/types';

// Top-down jet silhouette centred at (0,0), nose at −y (pointing up).
const JET_PATH = [
  'M 0,-14 C 3,-11 3,8 1,15 C 0.5,16.5 -0.5,16.5 -1,15 C -3,8 -3,-11 0,-14 Z',
  'M -1.5,1 L -23,10 L -20,14 L -1.5,4.5 Z',
  'M 1.5,1 L 23,10 L 20,14 L 1.5,4.5 Z',
  'M -1,13 L -11,17.5 L -10,19 L -1,15 Z',
  'M 1,13 L 11,17.5 L 10,19 L 1,15 Z',
].join(' ');

const TRAIL: [number, number, number][] = [
  [0, 28, 0.40],
  [0, 40, 0.22],
  [0, 54, 0.09],
];

function acColor(fuel: number, crashed: boolean) {
  if (crashed) return 'var(--color-atc-warn)';
  if (fuel <= 10) return 'var(--color-atc-warn)';
  if (fuel <= 25) return 'var(--color-atc-amber)';
  return 'var(--color-atc-hud)';
}
function barColor(fuel: number, crashed: boolean) {
  if (crashed) return 'var(--color-atc-warn)';
  if (fuel <= 10) return 'var(--color-atc-warn)';
  if (fuel <= 25) return 'var(--color-atc-amber)';
  return 'var(--color-atc-scope)';
}
function glowId(fuel: number, crashed: boolean) {
  if (crashed || fuel <= 10) return 'url(#glr)';
  return 'url(#gls)';
}

const W      = 110; // box width (extra room for crash line)
const H_BASE = 44;
const H_ASGN = 57;
const H_CRASH = 68; // extra line for CRASH
const OFFSET = 20;

interface Props {
  aircraft: Aircraft;
  x: number;
  y: number;
  scopeCX: number;
  scopeCY: number;
  scopeR: number;
  etaSec?: number;
  assignedRunway?: string;
  isCrashed?: boolean;
}

export default function AircraftBlip({
  aircraft, x, y, scopeCX, scopeR, etaSec, assignedRunway, isCrashed = false,
}: Props) {
  const { callsign, category, fuelPercent, altitude, headingDeg, speedKts } = aircraft;

  const color  = acColor(fuelPercent, isCrashed);
  const bar    = barColor(fuelPercent, isCrashed);
  const glow   = glowId(fuelPercent, isCrashed);
  const isCrit = fuelPercent <= 10;

  const H = isCrashed ? H_CRASH : assignedRunway ? H_ASGN : H_BASE;

  const onLeft = x <= scopeCX;
  let hx = onLeft ? x + OFFSET : x - OFFSET - W;
  const scopeTop    = scopeCX - scopeR + 20;
  const scopeBottom = scopeCX + scopeR - 20;
  let hy = y - H / 2;
  hy = Math.max(scopeTop,    hy);
  hy = Math.min(scopeBottom - H, hy);

  const lx = onLeft ? x + 12 : x - 12;

  const fl = `FL${String(Math.round(altitude / 100)).padStart(3, '0')}`;
  const eta = etaSec != null
    ? `${String(Math.floor(etaSec / 60)).padStart(2,'0')}:${String(etaSec % 60).padStart(2,'0')}`
    : '----';

  const FUEL_W = 36;
  const fuelFill = Math.max(1, (fuelPercent / 100) * FUEL_W);

  return (
    <g>
      {/* Leader line */}
      <line
        x1={lx} y1={y}
        x2={onLeft ? hx : hx + W} y2={hy + H / 2}
        stroke={isCrashed ? 'var(--color-atc-warn)' : 'var(--color-atc-scope)'}
        strokeWidth={0.8}
        strokeDasharray="3 3"
        opacity={0.45}
      />

      {/* HUD data block */}
      <g transform={`translate(${hx},${hy})`}>
        {/* Box border */}
        {(isCrit || isCrashed) ? (
          <motion.rect
            x={0} y={0} width={W} height={H}
            fill="rgba(5,8,15,0.88)"
            stroke={isCrashed ? 'var(--color-atc-warn)' : 'var(--color-atc-warn)'}
            strokeWidth={isCrashed ? 1.5 : 0.9}
            animate={{ opacity: isCrashed ? [1, 1] : [0.7, 1.0, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <rect x={0} y={0} width={W} height={H}
            fill="rgba(5,8,15,0.88)"
            stroke="var(--color-atc-border)"
            strokeWidth={0.5}
          />
        )}

        {/* Crash alert bar across top */}
        {isCrashed && (
          <motion.rect
            x={0} y={0} width={W} height={3}
            fill="var(--color-atc-warn)"
            animate={{ opacity: [1.0, 0.3, 1.0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {/* Critical bar across top (non-crash) */}
        {isCrit && !isCrashed && (
          <motion.rect
            x={0} y={0} width={W} height={3}
            fill="var(--color-atc-warn)"
            animate={{ opacity: [0.7, 1.0, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Line 1: callsign + FL */}
        <text x={5} y={13}
          fill={color} fontSize={9.5} fontFamily="var(--font-mono)" fontWeight={700} letterSpacing={0.8}>
          {callsign}
        </text>
        <text x={W - 5} y={13} textAnchor="end"
          fill="var(--color-atc-hud)" fontSize={9} fontFamily="var(--font-mono)" opacity={0.85}>
          {fl}
        </text>

        {/* Line 2: fuel bar */}
        <text x={5} y={25}
          fill="var(--color-atc-mute)" fontSize={7} fontFamily="var(--font-mono)" opacity={0.7}>
          {category.slice(0,3)}
        </text>
        <rect x={22} y={18} width={FUEL_W} height={3.5}
          fill="none" stroke="var(--color-atc-mute)" strokeWidth={0.4} opacity={0.5} />
        <rect x={22} y={18} width={fuelFill} height={3.5} fill={bar} opacity={0.9} />
        <text x={62} y={25}
          fill={color} fontSize={7.5} fontFamily="var(--font-mono)">
          {fuelPercent}%
        </text>
        <text x={W - 5} y={25} textAnchor="end"
          fill="var(--color-atc-mute)" fontSize={7} fontFamily="var(--font-mono)" opacity={0.6}>
          FUEL
        </text>

        {/* Line 3: speed + ETA */}
        <text x={5} y={38}
          fill="var(--color-atc-cyan)" fontSize={8} fontFamily="var(--font-mono)">
          {speedKts}KT
        </text>
        <text x={W - 5} y={38} textAnchor="end"
          fill="var(--color-atc-mute)" fontSize={8} fontFamily="var(--font-mono)">
          {eta}
        </text>

        {/* Line 4: assigned runway or CRASH */}
        {isCrashed && (
          <>
            <line x1={0} y1={45} x2={W} y2={45}
              stroke="var(--color-atc-warn)" strokeWidth={0.5} opacity={0.4} />
            <motion.text x={5} y={54}
              fill="var(--color-atc-warn)" fontSize={7.5} fontFamily="var(--font-mono)"
              fontWeight={700} letterSpacing={0.3} filter="url(#glr)"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}>
              ⚠ FUEL EXHAUSTED
            </motion.text>
            <text x={5} y={64}
              fill="var(--color-atc-warn)" fontSize={7.5} fontFamily="var(--font-mono)"
              fontWeight={700} letterSpacing={0.3} filter="url(#glr)">
              — CRASH
            </text>
          </>
        )}
        {!isCrashed && assignedRunway && (
          <>
            <line x1={0} y1={45} x2={W} y2={45}
              stroke="var(--color-atc-scope)" strokeWidth={0.4} opacity={0.3} />
            <text x={5} y={54}
              fill="var(--color-atc-scope)" fontSize={8} fontFamily="var(--font-mono)"
              fontWeight={700} letterSpacing={0.5} filter="url(#gls)">
              → {assignedRunway} · CLR LAND
            </text>
          </>
        )}
      </g>

      {/* Aircraft silhouette — or red X if crashed */}
      <g transform={`translate(${x},${y}) rotate(${headingDeg})`}
         style={isCrashed ? { animation: 'crashFlash 1.5s ease-out' } : undefined}>
        {!isCrashed && TRAIL.map(([tx, ty, op], i) => (
          <circle key={i} cx={tx} cy={ty} r={1.5 - i * 0.35}
            fill={color} opacity={op} />
        ))}
        {isCrashed ? (
          // Red X mark
          <g filter="url(#glr)">
            <line x1={-10} y1={-10} x2={10} y2={10}
              stroke="var(--color-atc-warn)" strokeWidth={3} strokeLinecap="round" />
            <line x1={10} y1={-10} x2={-10} y2={10}
              stroke="var(--color-atc-warn)" strokeWidth={3} strokeLinecap="round" />
          </g>
        ) : (
          <path d={JET_PATH} fill={color} opacity={0.93} filter={glow} />
        )}
      </g>
    </g>
  );
}

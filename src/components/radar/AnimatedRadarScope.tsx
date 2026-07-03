'use client';

import { useEffect, useRef, useState } from 'react';
import type { Aircraft, Runway } from '@/simulation/types';
import { CX, CY, R, polarToSVG } from './RadarScope';
import RadarScope from './RadarScope';
import AircraftBlip from './AircraftBlip';
import HoldingPattern from './HoldingPattern';

const WOBBLE_AMP    = 2;
const WOBBLE_PERIOD = 4000;

const THRESHOLDS: Record<string, [number, number]> = {
  '09L': [CX - 40, CY + 5],
  '27R': [CX + 40, CY + 5],
  '09R': [CX - 40, CY - 9],
  '27L': [CX + 40, CY - 9],
};

interface AcState {
  id:     string;
  x:      number;
  y:      number;
  wobble: number;
}

const RWY_LEN  = 80;
const RWY_HALF = RWY_LEN / 2;
const RWY_N_Y  = CY - 12;
const RWY_S_Y  = CY + 2;
const RWY_W    = 6;

function PapiLights({ papiOn }: { papiOn: boolean }) {
  const opacity = papiOn ? 0.85 : 0.25;
  const filter  = papiOn ? 'url(#gls)' : undefined;
  return (
    <>
      {[0,1,2,3].map(p => <circle key={`nw${p}`} cx={CX-RWY_HALF+3+p*5} cy={RWY_N_Y-4}       r={2} fill="var(--color-atc-scope)" opacity={opacity} filter={filter} />)}
      {[0,1,2,3].map(p => <circle key={`ne${p}`} cx={CX+RWY_HALF-3-p*5} cy={RWY_N_Y-4}       r={2} fill="var(--color-atc-scope)" opacity={opacity} filter={filter} />)}
      {[0,1,2,3].map(p => <circle key={`sw${p}`} cx={CX-RWY_HALF+3+p*5} cy={RWY_S_Y+RWY_W+4} r={2} fill="var(--color-atc-scope)" opacity={opacity} filter={filter} />)}
      {[0,1,2,3].map(p => <circle key={`se${p}`} cx={CX+RWY_HALF-3-p*5} cy={RWY_S_Y+RWY_W+4} r={2} fill="var(--color-atc-scope)" opacity={opacity} filter={filter} />)}
    </>
  );
}

interface Props {
  aircraft:    Aircraft[];
  runways:     Runway[];
  assignments?: Record<string, string> | null;
  crashedAircraftIds?: string[];
}

export default function AnimatedRadarScope({ aircraft, runways, assignments, crashedAircraftIds = [] }: Props) {
  const crashedSet = new Set(crashedAircraftIds);

  const [positions, setPositions] = useState<AcState[]>(() =>
    aircraft.map(ac => {
      const [x, y] = polarToSVG(ac.positionAngleDeg, ac.distanceNM);
      return { id: ac.id, x, y, wobble: ac.headingDeg };
    })
  );

  const [papiOn, setPapiOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPapiOn(v => !v), 2000);
    return () => clearInterval(id);
  }, []);

  const rafRef = useRef<number>(0);
  const t0Ref  = useRef<number | null>(null);

  useEffect(() => {
    function tick(ts: number) {
      if (t0Ref.current === null) t0Ref.current = ts;
      const t = ts - t0Ref.current;

      setPositions(aircraft.map(ac => {
        const [x, y] = polarToSVG(ac.positionAngleDeg, ac.distanceNM);
        const wobble = ac.headingDeg + WOBBLE_AMP * Math.sin((t / WOBBLE_PERIOD) * 2 * Math.PI);
        return { id: ac.id, x, y, wobble };
      }));

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [aircraft]);

  const posMap = new Map(positions.map(p => [p.id, p]));

  // Build vectors — crashed ones use red stroke
  const vectors: {
    key: string;
    x1: number; y1: number; x2: number; y2: number;
    len: number; delay: number; crashed: boolean;
  }[] = [];

  if (assignments) {
    aircraft.forEach((ac, i) => {
      const rwyDes = assignments[ac.id];
      if (!rwyDes) return;
      const threshold = THRESHOLDS[rwyDes];
      if (!threshold) return;
      const [x1, y1] = polarToSVG(ac.positionAngleDeg, ac.distanceNM);
      const [x2, y2] = threshold;
      const len = Math.hypot(x2 - x1, y2 - y1);
      vectors.push({
        key: ac.id, x1, y1, x2, y2, len,
        delay: i * 60,
        crashed: crashedSet.has(ac.id),
      });
    });
  }

  const vectorGroupKey = assignments ? JSON.stringify(assignments) + crashedAircraftIds.join(',') : 'none';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <RadarScope aircraft={aircraft} runways={runways} hidePapi hideAircraft />

      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <g clipPath="url(#sc)">
          <PapiLights papiOn={papiOn} />

          {aircraft.filter(ac => ac.isDummy).map(ac => {
            const pos = posMap.get(ac.id);
            if (!pos) return null;
            return (
              <HoldingPattern key={ac.id} cx={pos.x} cy={pos.y} rx={36} ry={22}
                label={`HOLD FL${String(Math.round(ac.altitude / 100)).padStart(3, '0')}`} />
            );
          })}

          {/* Assignment vectors */}
          {assignments && (
            <g key={vectorGroupKey}>
              {vectors.map(v => (
                <line key={v.key}
                  x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}
                  stroke={v.crashed ? 'var(--color-atc-warn)' : 'var(--color-atc-scope)'}
                  strokeWidth={v.crashed ? 1.5 : 1.2}
                  strokeDasharray={`${v.len} ${v.len}`}
                  strokeDashoffset={v.len}
                  opacity={v.crashed ? 0.85 : 0.7}
                  style={{
                    animation: `drawLine 800ms ease-out ${v.delay}ms forwards`,
                  }}
                />
              ))}
            </g>
          )}

          {/* Runway threshold markers — ✗ for crashed, dot for normal */}
          {assignments && vectors.map(v => (
            v.crashed ? (
              // ✗ marker at runway threshold for crashed aircraft
              <g key={`dot-${v.key}`}
                style={{ animation: `drawLine 200ms ease-out ${v.delay + 750}ms forwards` }}
                opacity={0}
              >
                <line x1={v.x2 - 5} y1={v.y2 - 5} x2={v.x2 + 5} y2={v.y2 + 5}
                  stroke="var(--color-atc-warn)" strokeWidth={2} strokeLinecap="round"
                  filter="url(#glr)" />
                <line x1={v.x2 + 5} y1={v.y2 - 5} x2={v.x2 - 5} y2={v.y2 + 5}
                  stroke="var(--color-atc-warn)" strokeWidth={2} strokeLinecap="round"
                  filter="url(#glr)" />
              </g>
            ) : (
              <circle key={`dot-${v.key}`}
                cx={v.x2} cy={v.y2} r={3}
                fill="var(--color-atc-scope)" opacity={0.9}
                filter="url(#gls)"
                style={{ animation: `drawLine 200ms ease-out ${v.delay + 750}ms forwards` }}
              />
            )
          ))}

          {/* Aircraft blips */}
          {aircraft.map(ac => {
            const pos = posMap.get(ac.id);
            if (!pos) return null;
            const etaSec        = Math.round((ac.distanceNM / ac.speedKts) * 3600);
            const acWithWobble  = { ...ac, headingDeg: pos.wobble };
            const assignedRunway = assignments?.[ac.id];
            const isCrashed     = crashedSet.has(ac.id);
            return (
              <AircraftBlip
                key={ac.id}
                aircraft={acWithWobble}
                x={pos.x} y={pos.y}
                scopeCX={CX} scopeCY={CY} scopeR={R}
                etaSec={etaSec}
                assignedRunway={assignedRunway}
                isCrashed={isCrashed}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

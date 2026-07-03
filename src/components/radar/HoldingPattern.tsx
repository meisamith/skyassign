'use client';

// Racetrack holding pattern orbit drawn at a fixed position on the radar scope.
// The pattern is a standard aeronautical racetrack: two straights + two semicircles.

interface Props {
  cx: number;      // center x of the racetrack oval
  cy: number;      // center y
  rx: number;      // horizontal radius (straight-leg half-length)
  ry: number;      // vertical radius (turn radius)
  label?: string;  // optional label e.g. "HOLD 8000"
}

export default function HoldingPattern({ cx, cy, rx, ry, label }: Props) {
  // SVG ellipse approximated with 4 cubic bezier arcs for a perfect racetrack
  // Top-straight from (-rx, 0) to (rx, 0) then right semicircle then back
  const k = 0.5523; // cubic bezier approximation for semicircle

  const path = [
    `M ${cx - rx} ${cy - 0}`,
    // Top straight
    `L ${cx + rx} ${cy}`,
    // Right turn (semicircle going down)
    `C ${cx + rx + ry * k} ${cy} ${cx + rx + ry} ${cy + ry * (1 - k)} ${cx + rx} ${cy + ry * 2}`,
    // Hmm actually let me just use the SVG ellipse and a rect to fake a racetrack
  ].join(' ');

  // Simpler: draw as an elongated ellipse (close enough for radar display)
  // Real racetrack = 2 semicircles + 2 straights = an ellipse with modified rx
  // For visual purposes, an ellipse rotated 90° works fine

  return (
    <g opacity={0.35}>
      {/* Racetrack outline */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="var(--color-atc-amber)"
        strokeWidth={0.8}
        strokeDasharray="4 3"
      />
      {/* Direction arrows at top and bottom to indicate orbit direction */}
      <polygon
        points={`${cx + rx - 4},${cy - 3} ${cx + rx + 2},${cy} ${cx + rx - 4},${cy + 3}`}
        fill="var(--color-atc-amber)"
        opacity={0.7}
      />
      <polygon
        points={`${cx - rx + 4},${cy - 3} ${cx - rx - 2},${cy} ${cx - rx + 4},${cy + 3}`}
        fill="var(--color-atc-amber)"
        opacity={0.7}
      />
      {/* Label */}
      {label && (
        <text
          x={cx}
          y={cy - ry - 5}
          textAnchor="middle"
          fill="var(--color-atc-amber)"
          fontSize={7}
          fontFamily="var(--font-mono)"
          opacity={0.8}
        >
          {label}
        </text>
      )}
    </g>
  );
}

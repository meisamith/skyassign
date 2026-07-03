'use client';
import dynamic from 'next/dynamic';

const AnimatedRadarScope = dynamic(
  () => import('./AnimatedRadarScope'),
  { ssr: false }
);

export default AnimatedRadarScope;

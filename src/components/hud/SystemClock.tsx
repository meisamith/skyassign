'use client';

import { useEffect, useState } from 'react';

export default function SystemClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toUTCString().slice(17, 25) // HH:MM:SS
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-atc-hud tabular-nums tracking-widest">
      UTC {time || '--:--:--'}
    </span>
  );
}

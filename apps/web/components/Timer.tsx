"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  startedAt: string;
  timeLimitSec: number;
}

export default function Timer({ startedAt, timeLimitSec }: TimerProps) {
  const [remaining, setRemaining] = useState(timeLimitSec);

  useEffect(() => {
    const startedAtMs = new Date(startedAt).getTime();

    function tick() {
      const elapsed = (Date.now() - startedAtMs) / 1000;
      setRemaining(Math.max(0, Math.ceil(timeLimitSec - elapsed)));
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitSec]);

  return (
    <span className="rounded-full bg-black px-3 py-1 text-sm font-semibold text-white">
      {remaining}s
    </span>
  );
}

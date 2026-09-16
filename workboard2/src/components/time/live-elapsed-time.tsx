"use client";

import { useEffect, useMemo, useState } from "react";

export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function LiveElapsedTime({
  startedAt,
  baseSeconds = 0,
  className = "",
}: {
  startedAt: string;
  baseSeconds?: number;
  className?: string;
}) {
  const startedMs = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [seconds, setSeconds] = useState(() =>
    baseSeconds + Math.floor((Date.now() - startedMs) / 1000),
  );

  useEffect(() => {
    const sync = () => {
      setSeconds(
        baseSeconds + Math.floor((Date.now() - startedMs) / 1000),
      );
    };

    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [baseSeconds, startedMs]);

  return (
    <span
      className={className}
      aria-label={`เวลาที่ใช้ไป ${formatElapsed(seconds)}`}
    >
      {formatElapsed(seconds)}
    </span>
  );
}

export function ElapsedTime({
  seconds,
  className = "",
}: {
  seconds: number;
  className?: string;
}) {
  return <span className={className}>{formatElapsed(seconds)}</span>;
}

'use client';
import { useEffect, useState } from 'react';

function durations(log, at) {
  let shooting = 0, paused = 0, mode = null, since = null;
  for (const e of log) {
    const t = new Date(e.at).getTime();
    if (mode === 'shooting') shooting += t - since;
    if (mode === 'paused') paused += t - since;
    mode = e.kind === 'started' || e.kind === 'resumed' ? 'shooting' : e.kind === 'paused' ? 'paused' : null;
    since = t;
  }
  if (mode === 'shooting') shooting += at - since;
  if (mode === 'paused') paused += at - since;
  return [shooting, paused].map(ms => Math.max(0, Math.round(ms / 1000)));
}
const fmt = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

// Shooting vs paused time, ticking live while the batch is active.
export default function Ticker({ log }) {
  const [now, setNow] = useState(() => Date.now());
  const live = log.length && log.at(-1).kind !== 'finished';
  useEffect(() => { if (!live) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [live]);
  const [s, p] = durations(log, now);
  return <span className="mono">Shooting {fmt(s)} · Paused {fmt(p)}</span>;
}

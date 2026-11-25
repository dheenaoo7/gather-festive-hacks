'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Live desks: re-fetch server data every few seconds (no websockets needed for a demo-scale event).
export default function AutoRefresh({ ms = 4000 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, ms);
    return () => clearInterval(id);
  }, [ms, router]);
  return null;
}

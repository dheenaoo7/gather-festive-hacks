const TZ = 'Asia/Kolkata';
export const fmtDate = iso => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
export const fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
export const fmtWhen = iso => `${fmtDate(iso)} · ${fmtTime(iso)}`;
export const fmtSec = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ });
export const fmtDur = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
export const roleLabel = r => !r ? '' : r.kind === 'host' ? (r.lead ? 'Hosting' : `Co-hosting${r.duty ? ` · ${r.duty} desk` : ''}`) : r.kind === 'vendor' ? `Vending · ${r.service}` : 'Attending';

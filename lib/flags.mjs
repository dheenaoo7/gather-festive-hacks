import 'server-only';
// Server-side Flagsmith module switches, evaluated per Gather user identity (edge API, cached 20s).
const DEFAULTS = { module_photo_queue: true, module_food_queue: true, module_goodies: true, module_voice_calls: true };
const cache = new Map();

export async function flagsFor(userId) {
  const key = process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY;
  if (!key) return { ...DEFAULTS, source: 'defaults' };
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 20000) return hit.flags;
  try {
    const res = await fetch(`https://edge.api.flagsmith.com/api/v1/identities/?identifier=${encodeURIComponent(userId)}`, {
      headers: { 'X-Environment-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const flags = { ...DEFAULTS, source: 'flagsmith' };
    for (const f of data.flags ?? []) if (f.feature.name in DEFAULTS) flags[f.feature.name] = f.enabled;
    cache.set(userId, { at: Date.now(), flags });
    return flags;
  } catch {
    return { ...DEFAULTS, source: 'defaults' };
  }
}

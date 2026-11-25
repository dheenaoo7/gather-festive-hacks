// Base URL that phones should open (invitation QR, later webhook callbacks).
// Behind cloudflared the Host header is the origin (127.0.0.1), so set PUBLIC_URL to the tunnel/deploy URL.
export function publicBaseUrl(headers, publicUrl = process.env.PUBLIC_URL) {
  if (publicUrl) {
    try {
      const u = new URL(publicUrl);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.origin;
    } catch {}
  }
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

const hits = new Map<string, number[]>();

export function tooManyRequests(request: Request, bucket: string, limit = 20, windowMs = 60_000): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function limitedResponse(): Response {
  return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'cache-control': 'no-store' } });
}

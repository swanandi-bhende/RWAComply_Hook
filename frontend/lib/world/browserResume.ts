import { randomBytes } from 'node:crypto';
import { BROWSER_RESUME_HASH_DOMAIN, domainHash } from './sessionCrypto.ts';

export const RESUME_COOKIE = 'rwacomply_resume';
export const RESUME_TTL_SECONDS = 7 * 24 * 60 * 60;

export function newResumeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: domainHash(BROWSER_RESUME_HASH_DOMAIN, token) };
}

export function cookieIsSecure(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwarded) return forwarded === 'https';
  return new URL(request.url).protocol === 'https:';
}

export function resumeCookie(token: string, maxAge = RESUME_TTL_SECONDS, secure = false): string {
  return `${RESUME_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function readResumeToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === RESUME_COOKIE && /^[0-9a-f]{64}$/.test(rest.join('='))) return rest.join('=');
  }
  return null;
}

import { publicConfigError, readEnrollmentConfig } from '@/lib/world/config';
import { handleIdentity } from '@/lib/world/identity';
import { sharedEnrollmentStore } from '@/lib/world/enrollmentStore';

export const runtime = 'nodejs';

export function GET(request: Request): Response {
  try {
    const config = readEnrollmentConfig();
    return handleIdentity(request, { store: sharedEnrollmentStore(config.databasePath) });
  } catch (error) {
    const safe = publicConfigError(error, 'World ID configuration is unavailable');
    return Response.json({ error: safe }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}

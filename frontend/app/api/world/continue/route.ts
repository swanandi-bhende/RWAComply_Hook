import { publicConfigError, readEnrollmentConfig } from '@/lib/world/config';
import { handleContinue } from '@/lib/world/continue';
import { sharedEnrollmentStore } from '@/lib/world/enrollmentStore';
import { limitedResponse, tooManyRequests } from '@/lib/world/requestLimit';

export const runtime = 'nodejs';

export function POST(request: Request): Promise<Response> {
  if (tooManyRequests(request, 'continue')) return Promise.resolve(limitedResponse());
  try {
    const config = readEnrollmentConfig();
    return handleContinue(request, { store: sharedEnrollmentStore(config.databasePath) });
  } catch (error) {
    const safe = publicConfigError(error, 'World ID configuration is unavailable');
    return Promise.resolve(
      Response.json({ error: safe }, { status: 500, headers: { 'cache-control': 'no-store' } }),
    );
  }
}

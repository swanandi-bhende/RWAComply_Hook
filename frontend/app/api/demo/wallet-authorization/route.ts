import { readEnrollmentConfig } from '@/lib/world/config';
import { handleDemoAuthorization } from '@/lib/world/demoIdentity';
import { DemoStore } from '@/lib/world/demoStore';
import { sharedEnrollmentStore } from '@/lib/world/enrollmentStore';

export const runtime = 'nodejs';

export function POST(request: Request): Promise<Response> {
  try {
    const config = readEnrollmentConfig();
    sharedEnrollmentStore(config.databasePath);
    return handleDemoAuthorization(request, { store: new DemoStore(config.databasePath) });
  } catch {
    return Promise.resolve(Response.json({ error: 'Demo identity is unavailable' }, { status: 404, headers: { 'cache-control': 'no-store' } }));
  }
}

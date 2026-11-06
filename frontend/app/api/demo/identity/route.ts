import { readEnrollmentConfig } from '@/lib/world/config';
import { handleDemoIdentity } from '@/lib/world/demoIdentity';
import { DemoStore } from '@/lib/world/demoStore';
import { sharedEnrollmentStore } from '@/lib/world/enrollmentStore';

export const runtime = 'nodejs';

export function GET(request: Request): Response {
  try {
    const config = readEnrollmentConfig();
    sharedEnrollmentStore(config.databasePath);
    return handleDemoIdentity(request, { store: new DemoStore(config.databasePath) });
  } catch {
    return Response.json({ enabled: false }, { status: 200, headers: { 'cache-control': 'no-store' } });
  }
}

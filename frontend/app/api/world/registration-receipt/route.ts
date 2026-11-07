import { publicConfigError, readEnrollmentConfig } from '@/lib/world/config';
import { sharedEnrollmentStore } from '@/lib/world/enrollmentStore';
import { handleRegistrationReceipt } from '@/lib/world/registrationReceipt';

export const runtime = 'nodejs';

export function POST(request: Request): Promise<Response> {
  try {
    const config = readEnrollmentConfig();
    return handleRegistrationReceipt(request, { store: sharedEnrollmentStore(config.databasePath) });
  } catch (error) {
    const safe = publicConfigError(error, 'Allocation authorization is unavailable');
    return Promise.resolve(
      Response.json({ error: safe }, { status: 500, headers: { 'cache-control': 'no-store' } }),
    );
  }
}

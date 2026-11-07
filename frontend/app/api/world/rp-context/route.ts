import { handleRpContext } from '@/lib/world/rpContextRoute';
import { limitedResponse, tooManyRequests } from '@/lib/world/requestLimit';

export const runtime = 'nodejs';

export function POST(request: Request): Promise<Response> {
  if (tooManyRequests(request, 'rp-context')) return Promise.resolve(limitedResponse());
  return handleRpContext(request);
}

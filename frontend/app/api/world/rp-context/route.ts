import { handleRpContext } from '@/lib/world/rpContextRoute';

export function POST(request: Request): Promise<Response> {
  return handleRpContext(request);
}

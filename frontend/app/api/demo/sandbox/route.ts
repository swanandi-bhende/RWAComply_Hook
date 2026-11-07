import { localDemoAllowed, parseSandboxRequest, sandboxAvailability } from '@/lib/demo/sandbox';
import { readSandbox, resetSandbox, runPurchase } from '@/lib/demo/sandboxChain';

export const runtime = 'nodejs';

function denied(): Response {
  return Response.json({ error: 'Local demo is not enabled' }, { status: 404, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const availability = sandboxAvailability(process.env, request.headers.get('host'));
  if (!availability.available) {
    return Response.json(availability, { headers: { 'cache-control': 'no-store' } });
  }
  try {
    return Response.json(await readSandbox(), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The local demo could not be read.';
    return Response.json({ error: message }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!localDemoAllowed(process.env, request.headers.get('host'))) return denied();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  const parsed = parseSandboxRequest(payload);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    if (parsed.action === 'status') return Response.json(await readSandbox(), { headers: { 'cache-control': 'no-store' } });
    if (parsed.action === 'reset') return Response.json(await resetSandbox(), { headers: { 'cache-control': 'no-store' } });
    const result = await runPurchase(parsed.action);
    const status = await readSandbox();
    return Response.json({ result, status }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The local demo action failed.';
    return Response.json({ error: message }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

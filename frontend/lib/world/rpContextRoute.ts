import { WorldConfigError, readWorldConfig, type WorldEnv } from './config.ts';
import { isRpIntent, signRpContext, type RpIntent } from './rpContext.ts';

const FORBIDDEN_FIELDS = [
  'action',
  'signingKey',
  'signing_key',
  'signingKeyHex',
  'WORLD_RP_SIGNING_KEY',
] as const;

function clientError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function handleRpContext(
  request: Request,
  env: WorldEnv = process.env,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return clientError('Invalid request body', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return clientError('Invalid request body', 400);
  }

  const record = body as Record<string, unknown>;
  if (FORBIDDEN_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(record, field))) {
    return clientError('Unsupported request field', 400);
  }

  if (typeof record.intent !== 'string' || !isRpIntent(record.intent)) {
    return clientError('Unsupported intent', 400);
  }

  const intent: RpIntent = record.intent;

  let config: ReturnType<typeof readWorldConfig>;
  try {
    config = readWorldConfig(env);
  } catch (error) {
    if (error instanceof WorldConfigError) {
      return clientError(error.message, 500);
    }
    return clientError('World ID configuration is unavailable', 500);
  }

  try {
    const rpContext = signRpContext({
      rpId: config.rpId,
      signingKeyHex: config.signingKeyHex,
      intent,
    });
    return Response.json({
      app_id: config.appId,
      rp_context: rpContext,
    });
  } catch {
    return clientError('Unable to sign the relying-party context', 500);
  }
}

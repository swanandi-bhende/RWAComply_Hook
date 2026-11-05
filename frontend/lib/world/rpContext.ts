import { signRequest } from '@worldcoin/idkit-core/signing';

export const RP_CONTEXT_TTL_SECONDS = 300;

/**
 * Enrollment signs the server action "signup".
 * A later session proof signs no action. World ID documents
 * `signRequest({ signingKeyHex })` for session-only requests, so this
 * endpoint does not invent a second action name.
 */
export const RP_INTENTS = ['signup', 'continue'] as const;

export type RpIntent = (typeof RP_INTENTS)[number];

export type RpContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export function isRpIntent(value: string): value is RpIntent {
  return (RP_INTENTS as readonly string[]).includes(value);
}

export function signRpContext(input: {
  rpId: string;
  signingKeyHex: string;
  intent: RpIntent;
}): RpContext {
  const signed =
    input.intent === 'signup'
      ? signRequest({
          signingKeyHex: input.signingKeyHex,
          action: 'signup',
          ttl: RP_CONTEXT_TTL_SECONDS,
        })
      : signRequest({
          signingKeyHex: input.signingKeyHex,
          ttl: RP_CONTEXT_TTL_SECONDS,
        });

  return {
    rp_id: input.rpId,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
    signature: signed.sig,
  };
}

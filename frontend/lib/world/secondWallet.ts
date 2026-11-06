export type SecondWalletResult = {
  registered: boolean;
  stage: 'continuation' | 'authorization' | 'registration' | 'remaining';
  reason?: string;
  message?: string;
  remaining?: bigint;
};

export async function runSecondWallet<TAuth extends { ok: true }>(options: {
  continueSession: () => Promise<{ ok: true; continuationToken: string } | { ok: false; reason: string }>;
  authorize: (continuationToken: string) => Promise<({ ok: false; reason: string }) | ({ ok: true } & TAuth)>;
  register: (authorization: { ok: true } & TAuth) => Promise<{ ok: boolean; message?: string }>;
  readRemaining: () => Promise<bigint>;
}): Promise<SecondWalletResult> {
  const continued = await options.continueSession();
  if (!continued.ok) {
    return { registered: false, stage: 'continuation', reason: continued.reason };
  }
  const authorized = await options.authorize(continued.continuationToken);
  if (!authorized.ok) {
    return { registered: false, stage: 'authorization', reason: authorized.reason };
  }
  const registered = await options.register(authorized);
  if (!registered.ok) {
    return { registered: false, stage: 'registration', reason: 'register_failed', message: registered.message };
  }
  try {
    const remaining = await options.readRemaining();
    return { registered: true, stage: 'remaining', remaining };
  } catch {
    return { registered: true, stage: 'remaining', reason: 'remaining_unreadable' };
  }
}

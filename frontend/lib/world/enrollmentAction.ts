import type { EnrollmentClientResult } from './enrollClient.ts';

export type EnrollmentActionResult = {
  registered: boolean;
  stage: 'enrollment' | 'authorization' | 'registration';
  reason?: string;
  message?: string;
};

export async function runEnrollmentAction<TAuth extends { ok: true }>(options: {
  enroll: () => Promise<EnrollmentClientResult>;
  authorize: (continuationToken: string) => Promise<({ ok: false; reason: string; message?: string }) | ({ ok: true } & TAuth)>;
  register: (authorization: { ok: true } & TAuth) => Promise<{ ok: boolean; message?: string }>;
}): Promise<EnrollmentActionResult> {
  const enrolled = await options.enroll();
  if (!enrolled.ok) {
    return { registered: false, stage: 'enrollment', reason: enrolled.reason };
  }
  if (!enrolled.continuationToken) {
    return { registered: false, stage: 'enrollment', reason: 'unexpected' };
  }
  const authorized = await options.authorize(enrolled.continuationToken);
  if (!authorized.ok) {
    return { registered: false, stage: 'authorization', reason: authorized.reason, message: authorized.message };
  }
  const registered = await options.register(authorized);
  return {
    registered: registered.ok,
    stage: 'registration',
    reason: registered.ok ? undefined : 'register_failed',
    message: registered.message,
  };
}

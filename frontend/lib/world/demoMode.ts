export type DemoMode = 'off' | 'local' | 'hackathon';

export function demoMode(env: { [key: string]: string | undefined }, hostHeader: string | null): DemoMode {
  const flag = env.RWA_DEMO_IDENTITY;
  if (flag !== 'local' && flag !== 'hackathon') return 'off';
  if (flag === 'hackathon') return 'hackathon';
  const host = (hostHeader ?? '').split(',')[0]?.trim().replace(/^\[|\]$/g, '').split(':')[0]?.toLowerCase() ?? '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'local';
  return 'off';
}

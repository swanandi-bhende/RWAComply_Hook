export const IDKIT_PACKAGE_VERSION = '4.6.0';

export const IDKIT_DEFAULT_BRIDGE = 'https://bridge.worldcoin.org';

const CONNECTOR_BY_ENVIRONMENT = {
  production: 'https://world.org/verify',
  staging: 'https://staging.world.org/verify',
  sandbox: 'https://sandbox.world.org/verify',
} as const;

export type ConnectorEnvironment = keyof typeof CONNECTOR_BY_ENVIRONMENT;

const CONNECTORS = new Set<string>(Object.values(CONNECTOR_BY_ENVIRONMENT));

export type WorldConnectorHandoff = {
  mode: 'qr';
  connectorURI: string;
  showQr: true;
  autoOpen: boolean;
  expiresAt: number;
};

export type WorldHandoff =
  | WorldConnectorHandoff
  | { mode: 'native'; expiresAt: number }
  | { mode: 'invalid' };

export function safeReturnTo(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function httpsReturnTo(value: string | undefined): string | undefined {
  const safe = safeReturnTo(value);
  if (!safe || new URL(safe).protocol !== 'https:') return undefined;
  return safe;
}

export type ConnectorInspection = {
  ok: boolean;
  environment: ConnectorEnvironment | null;
  host: string;
  path: string;
  parameters: { t: boolean; i: boolean; k: boolean; b: boolean };
  bridgeHost: string;
  error: string;
};

export function inspectConnector(connectorURI: string, expected: ConnectorEnvironment): ConnectorInspection {
  const empty = {
    ok: false,
    environment: null,
    host: '',
    path: '',
    parameters: { t: false, i: false, k: false, b: false },
    bridgeHost: 'bridge.worldcoin.org',
    error: 'The World App link was not valid. Start verification again.',
  };
  let url: URL;
  try {
    url = new URL(connectorURI);
  } catch {
    return empty;
  }
  const parameters = {
    t: url.searchParams.get('t') === 'wld',
    i: Boolean(url.searchParams.get('i')),
    k: Boolean(url.searchParams.get('k')),
    b: Boolean(url.searchParams.get('b')),
  };
  const base = `${url.origin}${url.pathname}`;
  const environment = (Object.entries(CONNECTOR_BY_ENVIRONMENT).find(([, value]) => value === base)?.[0] ?? null) as ConnectorEnvironment | null;
  const bridge = url.searchParams.get('b');
  let bridgeHost = 'bridge.worldcoin.org';
  if (bridge) {
    try {
      bridgeHost = new URL(bridge).host;
    } catch {
      bridgeHost = '';
    }
  }
  const report = { environment, host: url.host, path: url.pathname, parameters, bridgeHost, error: '' };
  if (!environment || !parameters.t || !parameters.i || !parameters.k) {
    return { ...report, ok: false, error: 'The World App link was not valid. Start verification again.' };
  }
  if (environment !== expected) {
    const error = environment === 'production'
      ? 'This connector targets production World App. The installed test app needs the sandbox connector.'
      : environment === 'staging'
        ? 'This connector targets the staging simulator. The installed test app needs the sandbox connector.'
        : 'This connector does not match the configured World App.';
    return { ...report, ok: false, error };
  }
  if (bridge && bridgeHost !== 'bridge.worldcoin.org') {
    return { ...report, ok: false, error: 'This connector uses a bridge the installed IDKit build does not use by default.' };
  }
  return { ...report, ok: true };
}

export function worldHandoff(input: {
  connectorURI: string;
  expiresAt: number;
  coarsePointer: boolean;
}): WorldHandoff {
  if (input.connectorURI === '') return { mode: 'native', expiresAt: input.expiresAt };
  let url: URL;
  try {
    url = new URL(input.connectorURI);
  } catch {
    return { mode: 'invalid' };
  }
  if (!CONNECTORS.has(`${url.origin}${url.pathname}`)) return { mode: 'invalid' };
  if (url.searchParams.get('t') !== 'wld' || !url.searchParams.get('i') || !url.searchParams.get('k')) {
    return { mode: 'invalid' };
  }
  return {
    mode: 'qr',
    connectorURI: input.connectorURI,
    showQr: true,
    autoOpen: input.coarsePointer,
    expiresAt: input.expiresAt,
  };
}

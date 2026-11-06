const CONNECTORS = new Set([
  'https://world.org/verify',
  'https://staging.world.org/verify',
  'https://sandbox.world.org/verify',
]);

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

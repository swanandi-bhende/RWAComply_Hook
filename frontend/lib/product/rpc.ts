import { http, webSocket, type Transport } from 'viem';

export function rpcTransport(url?: string): Transport {
  const trimmed = url?.trim() ?? '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return webSocket(trimmed);
  return http(trimmed || undefined);
}

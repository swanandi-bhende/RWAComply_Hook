import { http, type Transport } from 'viem';

export function rpcHttpUrl(url?: string): string {
  return (url?.trim() ?? '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

export function rpcTransport(url?: string): Transport {
  return http(rpcHttpUrl(url) || undefined);
}

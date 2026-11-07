import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { IDKit, CredentialRequest } from '@worldcoin/idkit-core';
import { signRequest } from '@worldcoin/idkit-core/signing';
import QRCode from 'qrcode';
import { IDKIT_PACKAGE_VERSION, inspectConnector, worldHandoff } from './handoff.ts';

const CONNECTOR = 'https://staging.world.org/verify?t=wld&i=reqtest123&k=abc';

test('a desktop handoff encodes the IDKit connector and rejects another URL', async () => {
  const plan = worldHandoff({ connectorURI: CONNECTOR, expiresAt: 1_800_000_000, coarsePointer: false });
  assert.equal(plan.mode, 'qr');
  if (plan.mode !== 'qr') return;
  assert.equal(plan.showQr, true);
  assert.equal(plan.autoOpen, false);
  assert.equal(plan.connectorURI, CONNECTOR);
  const image = await QRCode.toDataURL(plan.connectorURI, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
  assert.match(image, /^data:image\/png;base64,/);
  assert.equal(worldHandoff({ connectorURI: 'https://example.com/verify?t=wld&i=1&k=2', expiresAt: 1, coarsePointer: false }).mode, 'invalid');
  assert.equal(worldHandoff({ connectorURI: 'world://verify', expiresAt: 1, coarsePointer: false }).mode, 'invalid');
});

test('the phone connector is the sandbox URI and a decoded QR matches it exactly', async () => {
  const installed = JSON.parse(readFileSync(new URL('../../node_modules/@worldcoin/idkit-core/package.json', import.meta.url), 'utf8')) as { version: string };
  assert.equal(installed.version, IDKIT_PACKAGE_VERSION);

  const signed = signRequest({ signingKeyHex: `0x${'11'.repeat(32)}`, action: 'signup', ttl: 300 });
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(url, 'https://bridge.worldcoin.org/request');
    return new Response(JSON.stringify({ request_id: 'reqsandbox1' }), { status: 200 });
  };
  try {
    const request = await IDKit.request({
      app_id: 'app_test_fixture',
      action: 'signup',
      rp_context: {
        rp_id: 'rp_a11ce',
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        signature: signed.sig,
      },
      allow_legacy_proofs: false,
      environment: 'sandbox',
    }).constraints(CredentialRequest('proof_of_human'));
    const connector = request.connectorURI;
    assert.equal(connector.startsWith('https://sandbox.world.org/verify?t=wld&i=reqsandbox1&k='), true);
    assert.equal(connector.includes('https://world.org/verify'), false);
    assert.equal(connector.includes('staging.world.org'), false);
    const inspection = inspectConnector(connector, 'sandbox');
    assert.equal(inspection.ok, true);
    assert.equal(inspection.parameters.t, true);
    assert.equal(inspection.parameters.i, true);
    assert.equal(inspection.parameters.k, true);
    assert.equal(request.requestId, 'reqsandbox1');
    assert.equal(new URL(connector).searchParams.get('i'), request.requestId);
    const image = await QRCode.toDataURL(connector, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
    const decoded = await decodeQr(image);
    assert.equal(decoded, connector);
  } finally {
    globalThis.fetch = original;
  }
});

test('connector inspection rejects the wrong host, a bad signature target, and a foreign bridge', () => {
  const sandbox = 'https://sandbox.world.org/verify?t=wld&i=reqsandbox1&k=abc';
  const staging = 'https://staging.world.org/verify?t=wld&i=reqsandbox1&k=abc';
  const production = 'https://world.org/verify?t=wld&i=reqsandbox1&k=abc&b=https%3A%2F%2Fstaging.bridge.example';
  assert.equal(inspectConnector(staging, 'sandbox').ok, false);
  assert.match(inspectConnector(staging, 'sandbox').error, /staging simulator/);
  assert.equal(inspectConnector(staging, 'staging').ok, true);
  assert.equal(inspectConnector(production, 'production').ok, false);
  assert.match(inspectConnector(production, 'production').error, /bridge/);
  assert.equal(inspectConnector('https://example.com/verify?t=wld&i=1&k=2', 'sandbox').ok, false);
  assert.equal(inspectConnector(sandbox.replace('&k=abc', ''), 'sandbox').ok, false);
  assert.equal(inspectConnector(sandbox, 'sandbox').ok, true);
});

async function decodeQr(dataUrl: string): Promise<string> {
  const { PNG } = await import('pngjs') as { PNG: { sync: { read: (input: Buffer) => { data: Buffer; width: number; height: number } } } };
  const jsQR = (await import('jsqr')).default;
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(result);
  return result.data;
}

test('a phone opens the same connector and an in-app request has no QR', () => {
  const phone = worldHandoff({ connectorURI: CONNECTOR, expiresAt: 10, coarsePointer: true });
  assert.equal(phone.mode, 'qr');
  if (phone.mode === 'qr') assert.equal(phone.autoOpen, true);
  assert.deepEqual(worldHandoff({ connectorURI: '', expiresAt: 10, coarsePointer: true }), { mode: 'native', expiresAt: 10 });
});

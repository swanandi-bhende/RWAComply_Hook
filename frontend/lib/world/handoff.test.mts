import assert from 'node:assert/strict';
import test from 'node:test';
import QRCode from 'qrcode';
import { worldHandoff } from './handoff.ts';

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

test('a phone opens the same connector and an in-app request has no QR', () => {
  const phone = worldHandoff({ connectorURI: CONNECTOR, expiresAt: 10, coarsePointer: true });
  assert.equal(phone.mode, 'qr');
  if (phone.mode === 'qr') assert.equal(phone.autoOpen, true);
  assert.deepEqual(worldHandoff({ connectorURI: '', expiresAt: 10, coarsePointer: true }), { mode: 'native', expiresAt: 10 });
});

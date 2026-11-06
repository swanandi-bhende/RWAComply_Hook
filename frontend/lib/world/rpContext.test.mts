import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRpSignatureMessage } from '@worldcoin/idkit-core/signing';
import { privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { bytesToHex, hashMessage, hexToBytes, recoverAddress } from 'viem';
import { handleRpContext } from './rpContextRoute.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY =
  '0xabababababababababababababababababababababababababababababababab' as const;

const OFFICIAL_MESSAGE_WITHOUT_ACTION =
  '0x01008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd000000006553f100000000006553f22c';
const OFFICIAL_MESSAGE_WITH_ACTION =
  '0x01008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd000000006553f100000000006553f22c00aa0ce59768ae5b1c52f07a9387f14f09f277422c0d2f8a268c7bad0c60a46a';

function env() {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_PRIVATE_KEY: SIGNING_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(SIGNING_KEY).address,
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/world/rp-context', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type RpContextBody = {
  app_id: string;
  rp_context: {
    rp_id: string;
    nonce: `0x${string}`;
    created_at: number;
    expires_at: number;
    signature: `0x${string}`;
  };
};

async function signed(body: unknown, requestEnv = env()): Promise<RpContextBody> {
  const response = await handleRpContext(post(body), requestEnv);
  assert.equal(response.status, 200);
  return (await response.json()) as RpContextBody;
}

async function expectSignedByConfiguredKey(
  context: RpContextBody['rp_context'],
  action?: string,
): Promise<void> {
  const message = computeRpSignatureMessage(
    hexToBytes(context.nonce),
    context.created_at,
    context.expires_at,
    action,
  );
  const recovered = await recoverAddress({
    hash: hashMessage({ raw: message }),
    signature: context.signature,
  });
  assert.equal(recovered.toLowerCase(), privateKeyToAddress(SIGNING_KEY).toLowerCase());
}

test('installed SDK matches the official RP message test vectors', () => {
  const nonce = hexToBytes('0x008ae1aa597fa146ebd3aa2ceddf360668dea5e526567e92b0321816a4e895bd');
  assert.equal(
    bytesToHex(computeRpSignatureMessage(nonce, 1700000000, 1700000300)),
    OFFICIAL_MESSAGE_WITHOUT_ACTION,
  );
  assert.equal(
    bytesToHex(computeRpSignatureMessage(nonce, 1700000000, 1700000300, 'test-action')),
    OFFICIAL_MESSAGE_WITH_ACTION,
  );
});

test('a signup request returns a fresh relying-party context', async () => {
  const first = await signed({ intent: 'signup' });
  const second = await signed({ intent: 'signup' });

  assert.equal(first.app_id, APP_ID);
  assert.equal(first.rp_context.rp_id, RP_ID);
  assert.match(first.rp_context.nonce, /^0x[0-9a-fA-F]{64}$/);
  assert.match(first.rp_context.signature, /^0x[0-9a-fA-F]{130}$/);
  assert.equal(typeof first.rp_context.created_at, 'number');
  assert.equal(typeof first.rp_context.expires_at, 'number');
  assert.equal(Object.hasOwn(first.rp_context, 'createdAt'), false);
  assert.equal(Object.hasOwn(first.rp_context, 'expiresAt'), false);
  assert.equal(Object.hasOwn(first.rp_context, 'sig'), false);
  assert.ok(first.rp_context.expires_at > first.rp_context.created_at);
  assert.equal(first.rp_context.expires_at - first.rp_context.created_at, 300);
  assert.notEqual(first.rp_context.nonce, second.rp_context.nonce);
  assert.notEqual(first.rp_context.signature, second.rp_context.signature);

  await expectSignedByConfiguredKey(first.rp_context, 'signup');
  await expectSignedByConfiguredKey(second.rp_context, 'signup');
  await assert.rejects(expectSignedByConfiguredKey(first.rp_context));
});

test('continue signs a session proof without an action', async () => {
  const body = await signed({ intent: 'continue' });
  await expectSignedByConfiguredKey(body.rp_context);
  await assert.rejects(expectSignedByConfiguredKey(body.rp_context, 'signup'));
  await assert.rejects(expectSignedByConfiguredKey(body.rp_context, 'continue'));
});

test('invalid intents and client-supplied actions are rejected', async () => {
  for (const body of [{}, { intent: 'login' }, { intent: 'verify' }, { intent: 1 }, { intent: 'signup ' }]) {
    const response = await handleRpContext(post(body), env());
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error: string };
    assert.equal(payload.error, 'Unsupported intent');
  }

  for (const body of [
    { intent: 'signup', action: 'signup' },
    { intent: 'signup', action: 'not-signup' },
    { action: 'signup' },
    { intent: 'continue', signingKeyHex: SIGNING_KEY },
  ]) {
    const response = await handleRpContext(post(body), env());
    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error: string; rp_context?: unknown };
    assert.equal(payload.error, 'Unsupported request field');
    assert.equal(payload.rp_context, undefined);
    assert.equal(JSON.stringify(payload).includes(SIGNING_KEY), false);
  }
});

test('missing server configuration returns a controlled error', async () => {
  const response = await handleRpContext(
    post({ intent: 'signup' }),
    { WORLD_APP_ID: APP_ID, WORLD_RP_ID: RP_ID },
  );
  assert.equal(response.status, 500);
  const payload = (await response.json()) as { error: string };
  assert.equal(payload.error, 'WORLD_PRIVATE_KEY is not configured');
  assert.equal(JSON.stringify(payload).includes('stack'), false);
});

test('the response does not contain the signing key or identity material', async () => {
  const response = await handleRpContext(post({ intent: 'signup' }), env());
  const text = await response.text();
  assert.equal(text.includes(SIGNING_KEY), false);
  assert.equal(text.includes(SIGNING_KEY.slice(2)), false);
  assert.equal(text.toLowerCase().includes('nullifier'), false);
  assert.equal(text.includes('session_id'), false);
  assert.equal(text.includes('allocation'), false);
  const payload = JSON.parse(text) as RpContextBody;
  assert.deepEqual(Object.keys(payload).sort(), ['app_id', 'rp_context']);
  assert.deepEqual(Object.keys(payload.rp_context).sort(), [
    'created_at',
    'expires_at',
    'nonce',
    'rp_id',
    'signature',
  ]);
});

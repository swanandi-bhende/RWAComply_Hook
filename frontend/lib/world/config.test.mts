import assert from 'node:assert/strict';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import {
  publicWorldConfig,
  readEnrollmentConfig,
  readWorldConfig,
  WorldConfigError,
} from './config.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY = '0xabababababababababababababababababababababababababababababababab' as const;
const SIGNER_ADDRESS = privateKeyToAccount(SIGNING_KEY).address;
const OTHER_SIGNER = `0x${'11'.repeat(20)}`;

function fixtureEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_PRIVATE_KEY: SIGNING_KEY,
    WORLD_RP_SIGNER_ADDRESS: SIGNER_ADDRESS,
    ...overrides,
  };
}

test('missing WORLD_APP_ID fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_APP_ID: '   ' })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_APP_ID is not configured');
      assert.equal(error.message.includes(SIGNING_KEY), false);
      return true;
    },
  );
});

test('missing WORLD_RP_ID fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_RP_ID: '' })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_RP_ID is not configured');
      assert.equal(error.message.includes(SIGNING_KEY), false);
      return true;
    },
  );
});

test('missing WORLD_PRIVATE_KEY fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_PRIVATE_KEY: undefined })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_PRIVATE_KEY is not configured');
      return true;
    },
  );
});

test('missing WORLD_RP_SIGNER_ADDRESS fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_RP_SIGNER_ADDRESS: '' })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_RP_SIGNER_ADDRESS is not configured');
      assert.equal(error.message.includes(SIGNING_KEY), false);
      return true;
    },
  );
});

test('RP signer mismatch fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_RP_SIGNER_ADDRESS: OTHER_SIGNER })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_PRIVATE_KEY does not match WORLD_RP_SIGNER_ADDRESS');
      assert.equal(error.message.includes(SIGNING_KEY), false);
      assert.equal(error.message.toLowerCase().includes(OTHER_SIGNER.toLowerCase()), false);
      assert.equal(error.message.toLowerCase().includes(SIGNER_ADDRESS.toLowerCase()), false);
      return true;
    },
  );
});

test('valid configuration is accepted', () => {
  const config = readWorldConfig(fixtureEnv());
  assert.deepEqual(publicWorldConfig(fixtureEnv()), { appId: APP_ID, rpId: RP_ID });
  assert.equal(config.appId, APP_ID);
  assert.equal(config.rpId, RP_ID);
  assert.equal(Object.hasOwn(publicWorldConfig(fixtureEnv()), 'signingKeyHex'), false);
});

test('configuration errors do not include secret values', () => {
  const leaked = 'super-secret-signing-material';
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_PRIVATE_KEY: leaked })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_PRIVATE_KEY is invalid');
      assert.equal(error.message.includes(leaked), false);
      assert.equal(String(error).includes(leaked), false);
      return true;
    },
  );

  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_APP_ID: leaked })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_APP_ID is invalid');
      assert.equal(error.message.includes(leaked), false);
      return true;
    },
  );
});

test('invalid session encryption key fails closed', () => {
  const invalid = 'not-a-32-byte-encryption-secret';
  assert.throws(
    () =>
      readEnrollmentConfig(
        fixtureEnv({
          WORLD_ID_ENVIRONMENT: 'staging',
          WORLD_SESSION_ENCRYPTION_KEY: invalid,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_SESSION_ENCRYPTION_KEY is invalid');
      assert.equal(error.message.includes(invalid), false);
      return true;
    },
  );
});

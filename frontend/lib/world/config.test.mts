import assert from 'node:assert/strict';
import test from 'node:test';
import { publicWorldConfig, readWorldConfig, WorldConfigError } from './config.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_test_fixture';
const SIGNING_KEY = '0xabababababababababababababababababababababababababababababababab';

function fixtureEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_RP_SIGNING_KEY: SIGNING_KEY,
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

test('missing WORLD_RP_SIGNING_KEY fails closed', () => {
  assert.throws(
    () => readWorldConfig(fixtureEnv({ WORLD_RP_SIGNING_KEY: undefined })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_RP_SIGNING_KEY is not configured');
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
    () => readWorldConfig(fixtureEnv({ WORLD_RP_SIGNING_KEY: leaked })),
    (error: unknown) => {
      assert.ok(error instanceof WorldConfigError);
      assert.equal(error.message, 'WORLD_RP_SIGNING_KEY is invalid');
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

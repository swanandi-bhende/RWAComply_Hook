import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_LINKED_PRIMARY,
  DEMO_LINKED_STATUS,
  DEMO_READY,
  DEMO_UNLINKED,
  demoRegistrationCopy,
  identityMode,
} from './registrationMode.ts';

const ready = {
  wallet: 'connected' as const,
  network: 'sepolia' as const,
  linked: false,
  attempt: 'idle' as const,
};

test('an active demo identity owns registration and does not wait for World ID', () => {
  assert.equal(identityMode({ demo: 'active', world: 'unverified' }), 'demo');
  assert.equal(identityMode({ demo: 'active', world: 'verified' }), 'demo');
  assert.equal(identityMode({ demo: 'off', world: 'verified' }), 'world_id');
  assert.equal(identityMode({ demo: 'off', world: 'unverified' }), 'world_id');
  assert.equal(identityMode({ demo: 'none', world: 'unverified' }), 'choice');
  assert.equal(identityMode({ demo: 'expired', world: 'unverified' }), 'choice');

  const open = demoRegistrationCopy(ready);
  assert.equal(open.demo, DEMO_READY);
  assert.equal(open.register, DEMO_UNLINKED);
  assert.equal(open.register.includes('Not started'), false);
  assert.equal(open.register.includes('Link this wallet after verification'), false);
  assert.equal(open.demo.includes('World ID'), false);

  const linked = demoRegistrationCopy({ ...ready, linked: true });
  assert.equal(linked.demo, DEMO_LINKED_PRIMARY);
  assert.equal(linked.register, DEMO_LINKED_STATUS);

  const rejected = demoRegistrationCopy({ ...ready, attempt: 'transaction_rejected' });
  assert.match(rejected.demo, /was not registered/);
  assert.equal(rejected.register, rejected.demo);
  assert.equal(demoRegistrationCopy({ ...ready, attempt: 'receipt_failed' }).register, 'Receipt verification failed. This wallet was not registered.');
  assert.match(demoRegistrationCopy({ ...ready, network: 'wrong' }).register, /Ethereum Sepolia/);
  assert.match(demoRegistrationCopy({ ...ready, wallet: 'disconnected', network: 'unknown' }).register, /No wallet is connected/);
});

test('a second wallet is unregistered until its own result says it is linked', () => {
  const first = demoRegistrationCopy({ ...ready, linked: true });
  const second = demoRegistrationCopy({ ...ready, linked: false });
  assert.equal(first.register, DEMO_LINKED_STATUS);
  assert.equal(second.register, DEMO_UNLINKED);
  assert.equal(second.demo, DEMO_READY);
});

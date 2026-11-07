import assert from 'node:assert/strict';
import test from 'node:test';
import { infrastructureExplanation, infrastructureRole } from './walletRole.ts';

const SIGNER = '0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46';
const OWNER = '0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6';
const INVESTOR = '0x1111111111111111111111111111111111111111';

test('the allocation signer and contract owner are infrastructure wallets', () => {
  const roles = { backendSigner: SIGNER, owner: OWNER };
  assert.equal(infrastructureRole(SIGNER, roles), 'allocation signer');
  assert.equal(infrastructureRole(OWNER, roles), 'contract owner');
  assert.equal(infrastructureRole(INVESTOR, roles), null);
  assert.equal(infrastructureRole(undefined, roles), null);
  assert.match(infrastructureExplanation('allocation signer'), /separate funded investor wallet/);
  assert.match(infrastructureExplanation('allocation signer'), /does not reject/);
});

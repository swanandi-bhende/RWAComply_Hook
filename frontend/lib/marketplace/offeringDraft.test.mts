import assert from 'node:assert/strict';
import test from 'node:test';
import { indicativePrice, offeringErrors, type OfferingDraft } from './offeringDraft.ts';

const draft: OfferingDraft = {
  name: 'Solar Revenue Participation Token',
  symbol: 'SPRT',
  category: 'Demo infrastructure',
  description: 'A mock token for a local demonstration. It does not represent a real solar project.',
  cap: '1000000000',
  startTime: '10',
  endTime: '100',
  tokenReserve: '10000',
  usdcReserve: '1000000',
};

test('an offering draft rejects a missing cap and an ended window', () => {
  assert.equal(offeringErrors(draft, 20).length, 0);
  assert.ok(offeringErrors({ ...draft, cap: '0' }, 20).some((error) => error.includes('cap')));
  assert.ok(offeringErrors({ ...draft, endTime: '10' }, 20).some((error) => error.includes('end')));
});

test('the indicative price is the reserve ratio, not a valuation', () => {
  assert.equal(indicativePrice('10000', '1000000'), '100');
  assert.equal(indicativePrice('0', '100'), null);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('a purchase does not call Arkiv', () => {
  const investor = readFileSync(new URL('../../components/product/InvestorExperience.tsx', import.meta.url), 'utf8');
  const buy = investor.slice(investor.indexOf('async function buy'), investor.indexOf('async function approveUsdc') > -1
    ? investor.indexOf('catch (error)', investor.indexOf('async function buy'))
    : investor.length);
  const purchase = buy.slice(0, buy.indexOf('catch (error)'));
  assert.equal(purchase.includes('arkiv'), false);
  assert.equal(purchase.includes('/api/offerings'), false);
  assert.match(purchase, /swapExactInput/);

  const demo = readFileSync(new URL('../../components/SwapDemo.tsx', import.meta.url), 'utf8');
  assert.equal(demo.includes('@arkiv-network'), false);
  assert.equal(demo.includes('/api/offerings'), false);
  assert.match(demo, /writeContractAsync/);
});

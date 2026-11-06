import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const entity = '0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578';
const writer = '0xbfBf7Ca4f33993fA8b918d38286dad927231FB72';
const query = "projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')";

function doc(name: string): string {
  return readFileSync(new URL(name, root), 'utf8');
}

test('the prize notes answer the offering-directory questions', () => {
  const reach = doc('arkiv/reach.md');
  const why = doc('arkiv/why-arkiv.md');
  const how = doc('arkiv/how-you-use-arkiv.md');
  for (const text of [reach, why, how]) {
    assert.match(text, new RegExp(entity));
    assert.match(text, new RegExp(writer));
    assert.equal(text.includes('ARKIV_ACCESS_KEY='), false);
    assert.equal(text.includes('ARKIV_PUBLISHER_PRIVATE_KEY='), false);
  }
  assert.match(reach, /Who uses the product today/);
  assert.match(reach, /after Mumbai/);
  assert.match(why, /Arkiv cannot reject a swap/);
  assert.match(why, /kept off Arkiv/i);
  assert.match(how, /projectTag/);
  assert.match(how, /expires/);
  assert.match(how, /\/invest/);
  assert.equal(`${reach}\n${why}\n${how}`.includes(query), true);
});

test('the README query command names the writer and the entity', () => {
  const readme = doc('README.md');
  assert.match(readme, /npm run query:offering/);
  assert.match(readme, new RegExp(entity));
  assert.match(readme, new RegExp(writer));
});

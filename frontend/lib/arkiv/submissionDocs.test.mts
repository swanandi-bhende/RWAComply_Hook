import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

function doc(name: string): string {
  return readFileSync(new URL(name, root), 'utf8');
}

test('the README separates the pre-event hook from the added allocation path', () => {
  const readme = doc('README.md');
  assert.match(readme, /1629f37/);
  assert.match(readme, /What already existed/);
  assert.match(readme, /What was added/);
  for (const file of [
    'src/RWAComplyHook.sol',
    'src/AllocationLedger.sol',
    'src/PoolExecutor.sol',
    'frontend/app/api/world/enroll/route.ts',
    'frontend/app/api/world/continue/route.ts',
    'frontend/app/api/offerings/route.ts',
    'frontend/app/api/deployment-addresses/route.ts',
  ]) {
    assert.equal(readme.includes(file), true, file);
  }
  assert.equal(readme.includes('ARKIV_ACCESS_KEY='), false);
  assert.equal(readme.includes('PRIVATE_KEY='), false);
});

test('the README states the identity boundary and the run order', () => {
  const readme = doc('README.md');
  assert.match(readme, /session_id/);
  assert.match(readme, /stay in the backend/);
  assert.match(readme, /allocation id/);
  assert.match(readme, /Arkiv stores the public offering metadata/);
  const run = readme.slice(readme.indexOf('## Run'));
  const anvil = run.indexOf('anvil --host');
  const deploy = run.indexOf('script/start_anvil_demo.sh');
  const server = run.indexOf('npm run dev');
  const publish = run.indexOf('npm run publish:offering');
  const purchase = run.indexOf('script/demo_allocation_journey.sh');
  const tests = run.indexOf('forge test');
  assert.ok(anvil < deploy && deploy < server && server < publish && publish < purchase && purchase < tests);
});

test('the World note, the limits, and the demo script stay specific', () => {
  const world = doc('docs/world-integration.md');
  const script = doc('docs/demo-script.md');
  const readme = doc('README.md');
  assert.match(world, /has not been completed/);
  assert.match(world, /portal failures do not create an enrollment/);
  assert.match(world, /IDKit\.proveSession/);
  assert.match(world, /Cursor/);
  assert.match(world, /1629f37/);
  assert.match(readme, /not KYC or AML/);
  assert.match(readme, /exact-input USDC purchase/);
  assert.match(readme, /direct token transfers/);
  assert.match(readme, /Selling RWA does not restore the budget/);
  assert.match(script, /720p/);
  assert.match(script, /AI voiceover/);
  assert.match(script, /700/);
  assert.match(script, /500/);
  assert.match(script, /200/);
  assert.match(script, /Bob/);
  assert.equal(world.includes('PRIVATE_KEY='), false);
});

test('the partner file list is present and Swarm is not added', () => {
  const readme = doc('README.md');
  for (const file of [
    'FEEDBACK.md',
    'arkiv/schema.md',
    'arkiv/friction.md',
    'arkiv/reach.md',
    'arkiv/why-arkiv.md',
    'arkiv/how-you-use-arkiv.md',
  ]) {
    doc(file);
  }
  assert.match(readme, /0xbfBf7Ca4f33993fA8b918d38286dad927231FB72/);
  assert.match(readme, /projectTag = str\('rwacomply'\) AND offeringId = str\('sepolia-demo-rwa'\)/);
  assert.throws(() => doc('arkiv/swarm.md'));
});

test('the Uniswap feedback note points at the hook callbacks and the router', () => {
  const feedback = doc('FEEDBACK.md');
  assert.match(feedback, /https:\/\/developers\.uniswap\.org\/hackathon-feedback/);
  assert.match(feedback, /beforeSwap/);
  assert.match(feedback, /afterSwap/);
  assert.match(feedback, /swapExactInput/);
  assert.match(feedback, /src\/PoolExecutor\.sol/);
  assert.equal(feedback.includes('PRIVATE_KEY'), false);
});

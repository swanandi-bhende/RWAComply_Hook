import { readSandbox, resetSandbox, runPurchase, seedSandbox } from '../lib/demo/sandboxChain.ts';

try {
  await resetSandbox();
} catch {
  await seedSandbox();
}

const first = await runPurchase('buy-700');
const rejected = await runPurchase('attempt-500');
const second = await runPurchase('buy-200');
const status = await readSandbox();

const report = {
  chainId: status.chainId,
  buy700: { status: first.status, spent: first.spent, remaining: first.remaining, hash: first.hash },
  attempt500: { status: rejected.status, spent: rejected.spent, remaining: rejected.remaining, hash: rejected.hash },
  buy200: { status: second.status, spent: second.spent, remaining: second.remaining, hash: second.hash },
  aliceWalletARemaining: status.alice.a.remaining,
  aliceWalletBRemaining: status.alice.b.remaining,
  bobSpent: status.bob.a.spent,
  bobRemaining: status.bob.a.remaining,
};
console.log(JSON.stringify(report, null, 2));

if (first.status !== 'confirmed' || rejected.status !== 'rejected' || second.status !== 'confirmed') process.exit(1);
if (status.alice.a.remaining !== '100000000' || status.alice.b.remaining !== '100000000') process.exit(1);
if (status.bob.a.remaining !== '1000000000' || status.bob.a.spent !== '0') process.exit(1);

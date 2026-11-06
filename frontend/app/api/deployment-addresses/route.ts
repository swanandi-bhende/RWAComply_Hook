import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  marketFromCreations,
  marketFromDemoLog,
  selectAnvilMarket,
  type AnvilMarket,
} from '@/lib/demo/anvilDeployment';

async function readBroadcast(repoRoot: string): Promise<AnvilMarket | null> {
  try {
    const filePath = path.join(repoRoot, 'broadcast', 'DeployFull.s.sol', '31337', 'run-latest.json');
    const file = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(file) as { transactions?: Parameters<typeof marketFromCreations>[0] };
    return marketFromCreations(parsed.transactions ?? []);
  } catch {
    return null;
  }
}

async function readDemoLog(repoRoot: string): Promise<AnvilMarket | null> {
  try {
    const filePath = path.join(repoRoot, 'docs', 'demo_run_log.txt');
    const text = await fs.readFile(filePath, 'utf8');
    const partial = marketFromDemoLog(text);
    return selectAnvilMarket(null, partial);
  } catch {
    return null;
  }
}

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), '..');
  const [broadcast, demoLog] = await Promise.all([readBroadcast(repoRoot), readDemoLog(repoRoot)]);
  const market = selectAnvilMarket(broadcast, demoLog);
  if (!market) {
    return NextResponse.json(
      {
        error: 'Local Anvil deployment is not available. Run bash script/start_anvil_demo.sh, then refresh.',
      },
      { status: 503 },
    );
  }
  return NextResponse.json(market, { status: 200 });
}

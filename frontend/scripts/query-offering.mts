import path from 'node:path';
import { arkivPublicClient } from '../lib/arkiv/client.ts';
import {
  OfferingSchema,
  offeringFilter,
  offeringQueryText,
  publicOfferingFromRow,
} from '../lib/arkiv/offering.ts';
import { loadRepositoryEnv } from '../lib/world/loadRootEnv.ts';

loadRepositoryEnv(path.resolve(process.cwd(), '..'));

function publicError(error: unknown): string {
  const secrets = [process.env.ARKIV_ACCESS_KEY, process.env.ARKIV_PUBLISHER_PRIVATE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value && value.length > 8);
  let message = error instanceof Error ? error.message : 'The offering query failed';
  for (const secret of secrets) message = message.split(secret).join('[redacted]');
  return message.replace(/https?:\/\/\S+/g, '[url]').replace(/wss?:\/\/\S+/g, '[url]');
}

try {
  const arkiv = arkivPublicClient(process.env);
  const page = await arkiv.select({
    $key: true,
    $owner: true,
    projectTag: true,
    offeringId: true,
    rwaSymbol: true,
    usdcAddress: true,
    rwaAddress: true,
    poolId: true,
    expiresAt: true,
  }).from(OfferingSchema).where(offeringFilter()).fetch();
  if (page.entities.length !== 1) {
    throw new Error(`${page.entities.length} offerings match the query`);
  }
  const offering = publicOfferingFromRow(page.entities[0] as Record<string, unknown>);
  process.stdout.write(`entityKey ${offering.key}\nwriter ${offering.owner}\nquery ${offeringQueryText()}\n`);
  process.exit(0);
} catch (error) {
  process.stderr.write(`${publicError(error)}\n`);
  process.exit(1);
}

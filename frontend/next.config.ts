import path from 'node:path';
import type { NextConfig } from 'next';
import { loadRepositoryEnv } from './lib/world/loadRootEnv';

loadRepositoryEnv(path.resolve(process.cwd(), '..'));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HOOK_ADDRESS: process.env.NEXT_PUBLIC_HOOK_ADDRESS ?? '',
    NEXT_PUBLIC_EXECUTOR_ADDRESS: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? '',
    NEXT_PUBLIC_ORACLE_ADDRESS: process.env.NEXT_PUBLIC_ORACLE_ADDRESS ?? '',
    NEXT_PUBLIC_TOKEN_A_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS ?? '',
    NEXT_PUBLIC_TOKEN_B_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS ?? '',
    NEXT_PUBLIC_POOL_MANAGER: process.env.NEXT_PUBLIC_POOL_MANAGER ?? '',
  },
};

export default nextConfig;

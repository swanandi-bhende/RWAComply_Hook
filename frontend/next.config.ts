import path from 'node:path';
import type { NextConfig } from 'next';
import { loadRepositoryEnv } from './lib/world/loadRootEnv';

loadRepositoryEnv(path.resolve(process.cwd(), '..'));

const nextConfig: NextConfig = {};

export default nextConfig;

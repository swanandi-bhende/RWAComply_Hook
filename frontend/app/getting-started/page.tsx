'use client';

import dynamic from 'next/dynamic';

const GettingStarted = dynamic(
  () => import('@/components/product/GettingStarted').then((mod) => mod.GettingStarted),
  { ssr: false },
);

export default function GettingStartedPage() {
  return <GettingStarted />;
}

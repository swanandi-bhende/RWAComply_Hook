'use client';

import dynamic from 'next/dynamic';

const HowItWorks = dynamic(
  () => import('@/components/product/HowItWorks').then((mod) => mod.HowItWorks),
  { ssr: false },
);

export default function HowPage() {
  return <HowItWorks />;
}

'use client';

import dynamic from 'next/dynamic';

const OfferingDetail = dynamic(
  () => import('@/components/product/OfferingDetail').then((mod) => mod.OfferingDetail),
  { ssr: false },
);

export default function OfferingDetailPage() {
  return <OfferingDetail />;
}

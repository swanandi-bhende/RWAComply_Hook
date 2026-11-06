'use client';

import dynamic from 'next/dynamic';

const OfferingMarket = dynamic(
  () => import('@/components/product/OfferingMarket').then((mod) => mod.OfferingMarket),
  { ssr: false },
);

export default function OfferingsPage() {
  return <OfferingMarket />;
}

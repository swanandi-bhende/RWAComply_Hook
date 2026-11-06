'use client';

import dynamic from 'next/dynamic';

const IssuerDesk = dynamic(
  () => import('@/components/product/IssuerDesk').then((mod) => mod.IssuerDesk),
  { ssr: false },
);

export default function IssuerPage() {
  return <IssuerDesk />;
}

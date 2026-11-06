'use client';

import dynamic from 'next/dynamic';

const InvestorExperience = dynamic(() => import('@/components/product/InvestorExperience'), {
  ssr: false,
});

export default function InvestPage() {
  return <InvestorExperience />;
}

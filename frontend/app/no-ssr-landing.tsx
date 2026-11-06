'use client';

import dynamic from 'next/dynamic';

const Landing = dynamic(() => import('@/components/product/Landing').then((mod) => mod.Landing), {
  ssr: false,
});

export default function NoSsrLanding() {
  return <Landing />;
}

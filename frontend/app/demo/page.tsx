'use client';

import dynamic from 'next/dynamic';

const GuidedDemo = dynamic(() => import('@/components/demo/GuidedDemo').then((mod) => mod.GuidedDemo), {
  ssr: false,
});

export default function DemoPage() {
  return <GuidedDemo />;
}

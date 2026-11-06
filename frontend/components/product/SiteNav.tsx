'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/invest', label: 'Investor dashboard' },
  { href: '/invest#verify', label: 'Verify identity' },
  { href: '/invest#link', label: 'Link wallet' },
  { href: '/invest#purchase', label: 'Allocation' },
  { href: '/how', label: 'How it works' },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-black bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-black tracking-tight text-black">
          RWAComply
        </Link>
        <nav aria-label="Product" className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded px-3 py-2 text-sm font-semibold text-black hover:bg-gray-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
